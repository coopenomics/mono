import { Inject, Injectable, Logger } from '@nestjs/common';
import { affectedCount } from '@coopenomics/extension-kit';
import { sql, type Selectable } from 'kysely';
import type { BillingPaymentLog } from '~/infrastructure/database/kysely/database.types';
import { KYSELY, type Database } from '~/infrastructure/database/kysely/kysely.tokens';
import { BillingPaymentLogStatus, type BillingPaymentLogRecord } from './billing-payment-log.record';

function toRecord(row: Selectable<BillingPaymentLog>): BillingPaymentLogRecord {
  return {
    id: row.id,
    payment_hash: row.payment_hash,
    coopname: row.coopname,
    quantity: row.quantity,
    subject: row.subject,
    status: row.status as BillingPaymentLogStatus,
    tx_id: row.tx_id,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Результат попытки начать платёж: либо начали, либо есть существующая запись. */
export interface BeginPaymentResult {
  started: boolean;
  existing?: BillingPaymentLogRecord;
}

/**
 * Журнал биллинг-платежей — единственный источник идемпотентности `billing::pay`
 * на хабе (контракт on-chain таблиц не ведёт, RAM чейна на платежи не тратится;
 * решение @ant 2026-06-11).
 *
 * Протокол:
 * 1. `begin(payment_hash)` ДО transact — INSERT под уникальным индексом;
 *    конкурирующий тик/повтор получает `started: false` с текущей записью.
 * 2. `markSubmitted` после принятия транзакции нодой.
 * 3. `markConfirmed` после callback провайдеру (или от листенера парсера).
 * 4. `markFailed` — ТОЛЬКО для доменных отказов ноды (assert контракта,
 *    недостаток средств): повтор оплаты безопасен, begin перезапустит запись.
 *    Сетевые ошибки/timeout transact оставляют SUBMITTING — транзакция могла
 *    пройти, автоповтор запрещён до сверки с чейном (реактивный листенер
 *    парсера доведёт запись до CONFIRMED, если pay в итоге попал в блок).
 */
@Injectable()
export class BillingPaymentLogService {
  private readonly logger = new Logger(BillingPaymentLogService.name);

  constructor(@Inject(KYSELY) private readonly db: Database) {}

  /**
   * История списаний одного кооператива — для карточки в реестре совета.
   * Отдаём и незавершённые попытки: «оплата зависла» и «оплаты не было» —
   * разные вещи, и совет должен их различать.
   */
  async listByCoopname(coopname: string, limit = 50): Promise<BillingPaymentLogRecord[]> {
    const rows = await this.db
      .selectFrom('billing_payment_log')
      .selectAll()
      .where('coopname', '=', coopname)
      .orderBy('created_at', 'desc')
      // Потолок — чтобы карточка не тянула весь журнал за годы.
      .limit(Math.min(Math.max(limit, 1), 200))
      .execute();
    return rows.map(toRecord);
  }

  private async findByHash(paymentHash: string): Promise<BillingPaymentLogRecord | undefined> {
    const row = await this.db
      .selectFrom('billing_payment_log')
      .selectAll()
      .where('payment_hash', '=', paymentHash)
      .executeTakeFirst();
    return row ? toRecord(row) : undefined;
  }

  /** Правка записи по payment_hash; updated_at ставится вместе с правкой. */
  private async patch(
    paymentHash: string,
    values: Partial<Pick<BillingPaymentLogRecord, 'status' | 'tx_id' | 'last_error' | 'subject'>>,
  ): Promise<void> {
    await this.db
      .updateTable('billing_payment_log')
      .set({ ...values, updated_at: sql`now()` })
      .where('payment_hash', '=', paymentHash)
      .execute();
  }

  async begin(
    paymentHash: string,
    coopname: string,
    quantity: string,
    subject?: string,
  ): Promise<BeginPaymentResult> {
    const existing = await this.findByHash(paymentHash);
    if (existing) {
      if (existing.status === BillingPaymentLogStatus.FAILED) {
        // Доменный отказ ноды: повтор безопасен. CAS-переход FAILED → SUBMITTING,
        // чтобы наложившийся тик не начал второй платёж. Состав платежа мог
        // уточниться (сменился тариф), поэтому обновляется вместе со снятием ошибки.
        const updated = affectedCount(
          await this.db
            .updateTable('billing_payment_log')
            .set({
              status: BillingPaymentLogStatus.SUBMITTING,
              last_error: null,
              ...(subject ? { subject } : {}),
              updated_at: sql`now()`,
            })
            .where('payment_hash', '=', paymentHash)
            .where('status', '=', BillingPaymentLogStatus.FAILED)
            .execute(),
        );
        if (updated === 1) return { started: true };
      }
      return { started: false, existing };
    }

    try {
      await this.db
        .insertInto('billing_payment_log')
        .values({
          payment_hash: paymentHash,
          coopname,
          quantity,
          subject: subject ?? null,
          status: BillingPaymentLogStatus.SUBMITTING,
        })
        .execute();
      return { started: true };
    } catch (error: any) {
      // Гонка двух тиков: уникальный индекс по payment_hash отдал 23505.
      if (String(error?.code) === '23505') {
        return { started: false, existing: await this.findByHash(paymentHash) };
      }
      throw error;
    }
  }

  async markSubmitted(paymentHash: string, txId: string): Promise<void> {
    await this.patch(paymentHash, { status: BillingPaymentLogStatus.SUBMITTED, tx_id: txId || null });
  }

  async markConfirmed(paymentHash: string, txId?: string): Promise<void> {
    await this.patch(paymentHash, { status: BillingPaymentLogStatus.CONFIRMED, ...(txId ? { tx_id: txId } : {}) });
  }

  async markFailed(paymentHash: string, reason: string): Promise<void> {
    await this.patch(paymentHash, { status: BillingPaymentLogStatus.FAILED, last_error: reason.slice(0, 4000) });
  }

  /** Записать ошибку, не меняя статус (зависшее SUBMITTING — для диагностики). */
  async recordError(paymentHash: string, reason: string): Promise<void> {
    await this.patch(paymentHash, { last_error: reason.slice(0, 4000) });
  }
}
