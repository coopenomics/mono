import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CHAIN_PORT,
  LOGGER_PORT,
  PAYMENT_METHOD_PORT,
  PAYMENT_PORT,
  PaymentDirection,
  PaymentStatus,
  PaymentType,
  type IChainPort,
  type ILoggerPort,
  type InnerPaymentDetails,
  type InnerPaymentDraft,
  type IPaymentMethodPort,
  type IPaymentPort,
} from '@coopenomics/innercoop';
import { QuantityUtils, generateUniqueHash } from '@coopenomics/extension-kit';
import { t } from '../../i18n';

interface ChainAction {
  data: Record<string, unknown>;
}

/** Строка `capital::debts` — то, что нужно платежу. */
interface ChainDebtRow {
  username: string;
  debt_hash: string;
  amount: string;
  statement?: { meta?: unknown };
}

/**
 * Платёж кассиру по займу под коммиты (Генерация).
 *
 * Председатель подписал договор — контракт передал заём на выплату: заводится
 * исходящий платёж типа «заём». Хэш платежа — хэш займа: он же хэш исходящего
 * объекта в шлюзе, поэтому подтверждение и отказ кассира доходят до контракта
 * общим путём. Назначение — «заём по договору № …», реквизиты — платёжный
 * метод из заявления пайщика.
 *
 * После отказа по реквизитам и повтора платёж тот же: запись возвращается в
 * ожидание, новой не заводится.
 */
@Injectable()
export class CapitalDebtPaymentsListener {
  constructor(
    @Inject(PAYMENT_PORT) private readonly payments: IPaymentPort,
    @Inject(PAYMENT_METHOD_PORT) private readonly methods: IPaymentMethodPort,
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(CapitalDebtPaymentsListener.name);
  }

  @OnEvent('action::capital::debtsigned')
  async onSigned(action: ChainAction): Promise<void> {
    await this.ensurePayment(action);
  }

  @OnEvent('action::capital::debtretry')
  async onRetry(action: ChainAction): Promise<void> {
    await this.ensurePayment(action);
  }

  private async ensurePayment(action: ChainAction): Promise<void> {
    const coopname = String(action.data.coopname ?? '');
    const debtHash = String(action.data.debt_hash ?? '').toLowerCase();
    if (!coopname || !debtHash) return;
    try {
      const existing = await this.payments.findByHash(debtHash);
      if (existing) {
        await this.reopen(existing.id, existing.status, debtHash);
        return;
      }
      const debt = await this.chainDebt(coopname, debtHash);
      if (!debt) {
        this.logger.warn(`Заём ${debtHash} не найден в цепи — платёж кассиру не заведён`);
        return;
      }
      await this.payments.create(await this.draftOf(coopname, debt));
      this.logger.log(`Заведён исходящий платёж по займу ${debtHash} для ${debt.username}`);
    } catch (error: any) {
      this.logger.error(`Платёж по займу ${debtHash} не заведён: ${error.message}`, error.stack);
    }
  }

  /** Отклонённый платёж возвращается в ожидание; ожидающий и проведённый не трогаются. */
  private async reopen(id: string | undefined, status: PaymentStatus, debtHash: string): Promise<void> {
    if (!id || status === PaymentStatus.PENDING || status === PaymentStatus.COMPLETED) return;
    await this.payments.update(id, { status: PaymentStatus.PENDING, message: undefined });
    this.logger.log(`Платёж по займу ${debtHash} возвращён в ожидание после повтора`);
  }

  private async chainDebt(coopname: string, debtHash: string): Promise<ChainDebtRow | undefined> {
    const rows = await this.chain.getAllRows<ChainDebtRow>('capital', coopname, 'debts');
    return rows.find((row) => String(row.debt_hash).toLowerCase() === debtHash);
  }

  private async draftOf(coopname: string, debt: ChainDebtRow): Promise<InnerPaymentDraft> {
    const debtHash = String(debt.debt_hash).toLowerCase();
    const { amount, symbol } = QuantityUtils.parseQuantityString(debt.amount);
    const methodId = this.methodOf(debt.statement?.meta);
    const now = new Date();
    return {
      hash: debtHash,
      coopname,
      username: debt.username,
      quantity: amount,
      symbol,
      type: PaymentType.LOAN,
      direction: PaymentDirection.OUTGOING,
      status: PaymentStatus.PENDING,
      memo: t('capital.loanPayment.memo', { number: debtHash.slice(0, 8).toUpperCase() }),
      secret: generateUniqueHash(),
      payment_method_id: methodId,
      payment_details: await this.detailsOf(debt.username, methodId, amount),
      created_at: now,
      updated_at: now,
      blockchain_data: { debt_hash: debtHash },
      related_extension: 'capital',
    };
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

  private methodOf(meta: unknown): string | undefined {
    try {
      const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
      const value = (parsed as { method_id?: unknown } | undefined)?.method_id;
      return value ? String(value) : undefined;
    } catch {
      return undefined;
    }
  }
}
