import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CHAIN_PORT,
  LOGGER_PORT,
  PAYMENT_PORT,
  PaymentDirection,
  PaymentStatus,
  PaymentType,
  type IChainPort,
  type ILoggerPort,
  type InnerPaymentDraft,
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
      await this.payments.create(this.draftOf(coopname, debt));
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

  private draftOf(coopname: string, debt: ChainDebtRow): InnerPaymentDraft {
    const debtHash = String(debt.debt_hash).toLowerCase();
    const { amount, symbol } = QuantityUtils.parseQuantityString(debt.amount);
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
      payment_method_id: this.methodOf(debt.statement?.meta),
      created_at: now,
      updated_at: now,
      blockchain_data: { debt_hash: debtHash },
      related_extension: 'capital',
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
