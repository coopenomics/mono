import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  LOGGER_PORT,
  PAYMENT_PORT,
  PaymentDirection,
  PaymentStatus,
  PaymentType,
  type ILoggerPort,
  type InnerPaymentDraft,
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
      memo: t('payment.loanMemo', { number: entity.debt_hash.slice(0, 8).toUpperCase() }),
      secret: generateUniqueHash(),
      payment_method_id: methodId,
      created_at: now,
      updated_at: now,
      blockchain_data: { debt_hash: entity.debt_hash },
      related_extension: 'debt',
    };
    await this.payments.create(draft);
    this.logger.log(`Заведён исходящий платёж по займу ${entity.debt_hash} для ${entity.username}`);
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
