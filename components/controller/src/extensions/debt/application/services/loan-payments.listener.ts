import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  LOGGER_PORT,
  PAYMENT_METHOD_PORT,
  PAYMENT_PORT,
  PaymentDirection,
  PaymentStatus,
  PaymentType,
  type ILoggerPort,
  type InnerPaymentDetails,
  type InnerPaymentDraft,
  type IPaymentMethodPort,
  type IPaymentPort,
} from '@coopenomics/innercoop';
import { QuantityUtils, generateUniqueHash } from '@coopenomics/extension-kit';
import { LoanStatus } from '../../domain/enums/loan-status.enum';
import { LOAN_SYNCED_EVENT, type LoanSyncedPayload } from '../syncers/loan-sync.service';
import { t } from '../../i18n';

/**
 * Заводит исходящий платёж кассиру, когда председатель подписал договор и
 * контракт передал заём на выплату.
 *
 * Хэш платежа — хэш займа: он же хэш исходящего объекта в шлюзе, поэтому
 * подтверждение кассой общим путём (`gateway::outcomplete`) доходит до
 * контракта займов как `loanpaid`. Назначение — «заём по договору № …».
 * Реквизиты — платёжный метод из заявления пайщика (его метаданные).
 *
 * После отказа по реквизитам и повтора платёж тот же: запись возвращается
 * в ожидание, новой не заводится.
 */
@Injectable()
export class LoanPaymentsListener {
  constructor(
    @Inject(PAYMENT_PORT) private readonly payments: IPaymentPort,
    @Inject(PAYMENT_METHOD_PORT) private readonly methods: IPaymentMethodPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(LoanPaymentsListener.name);
  }

  @OnEvent(LOAN_SYNCED_EVENT)
  async handleLoanSynced(payload: LoanSyncedPayload): Promise<void> {
    const { entity } = payload;
    if (entity.status !== LoanStatus.PAYING || !entity.username || !entity.amount) return;

    const existing = await this.payments.findByHash(entity.debt_hash);
    if (existing) {
      if (existing.status !== PaymentStatus.PENDING && existing.status !== PaymentStatus.COMPLETED && existing.id) {
        await this.payments.update(existing.id, { status: PaymentStatus.PENDING, message: undefined });
        this.logger.log(`Платёж по займу ${entity.debt_hash} возвращён в ожидание после повтора`);
      }
      return;
    }

    const { amount, symbol } = QuantityUtils.parseQuantityString(entity.amount);
    const methodId = this.paymentMethodFromStatement(entity.statement?.meta);
    const now = new Date();
    const draft: InnerPaymentDraft = {
      hash: entity.debt_hash,
      coopname: entity.coopname,
      username: entity.username,
      quantity: amount,
      symbol,
      type: PaymentType.LOAN,
      direction: PaymentDirection.OUTGOING,
      status: PaymentStatus.PENDING,
      memo: t('debt.payment.loanMemo', { number: entity.debt_hash.slice(0, 8).toUpperCase() }),
      secret: generateUniqueHash(),
      payment_method_id: methodId,
      payment_details: await this.detailsOf(entity.username, methodId, amount),
      created_at: now,
      updated_at: now,
      blockchain_data: { debt_hash: entity.debt_hash },
      related_extension: 'debt',
    };
    await this.payments.create(draft);
    this.logger.log(`Заведён исходящий платёж по займу ${entity.debt_hash} для ${entity.username}`);
  }

  /**
   * Реквизиты для кассира — снимок платёжного метода из заявления пайщика.
   * Метод удалён или не указан — платёж заводится без реквизитов, кассир
   * отклонит его по реквизитам, и заём вернётся к повтору.
   */
  private async detailsOf(username: string, methodId: string | undefined, amount: number): Promise<InnerPaymentDetails> {
    let data: Record<string, any> = {};
    if (methodId) {
      try {
        data = (await this.methods.get({ username, method_id: methodId })).data as Record<string, any>;
      } catch (error: any) {
        this.logger.warn(`Реквизиты ${methodId} пайщика ${username} не найдены: ${error.message}`);
      }
    }
    return {
      data,
      amount_plus_fee: String(amount),
      amount_without_fee: String(amount),
      fee_amount: '0',
      fee_percent: 0,
      fact_fee_percent: 0,
      tolerance_percent: 0,
    };
  }

  private paymentMethodFromStatement(meta: unknown): string | undefined {
    try {
      const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
      const value = (parsed as { method_id?: unknown } | undefined)?.method_id;
      return value ? String(value) : undefined;
    } catch {
      return undefined;
    }
  }
}
