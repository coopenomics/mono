import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BillingPaymentLogEntity,
  BillingPaymentLogStatus,
} from './entities/billing-payment-log.entity';

/** Результат попытки начать платёж: либо начали, либо есть существующая запись. */
export interface BeginPaymentResult {
  started: boolean;
  existing?: BillingPaymentLogEntity;
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

  constructor(
    @InjectRepository(BillingPaymentLogEntity)
    private readonly repository: Repository<BillingPaymentLogEntity>,
  ) {}

  /**
   * История списаний одного кооператива — для карточки в реестре совета.
   * Отдаём и незавершённые попытки: «оплата зависла» и «оплаты не было» —
   * разные вещи, и совет должен их различать.
   */
  async listByCoopname(coopname: string, limit = 50): Promise<BillingPaymentLogEntity[]> {
    return this.repository.find({
      where: { coopname },
      order: { created_at: 'DESC' },
      // Потолок — чтобы карточка не тянула весь журнал за годы.
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async begin(paymentHash: string, coopname: string, quantity: string): Promise<BeginPaymentResult> {
    const existing = await this.repository.findOne({ where: { payment_hash: paymentHash } });
    if (existing) {
      if (existing.status === BillingPaymentLogStatus.FAILED) {
        // Доменный отказ ноды: повтор безопасен. CAS-переход FAILED → SUBMITTING,
        // чтобы наложившийся тик не начал второй платёж.
        const updated = await this.repository.update(
          { payment_hash: paymentHash, status: BillingPaymentLogStatus.FAILED },
          { status: BillingPaymentLogStatus.SUBMITTING, last_error: null },
        );
        if (updated.affected === 1) {
          return { started: true };
        }
      }
      return { started: false, existing };
    }

    try {
      await this.repository.insert(
        new BillingPaymentLogEntity({
          payment_hash: paymentHash,
          coopname,
          quantity,
          status: BillingPaymentLogStatus.SUBMITTING,
        }),
      );
      return { started: true };
    } catch (error: any) {
      // Гонка двух тиков: уникальный индекс по payment_hash отдал 23505.
      if (String(error?.code) === '23505') {
        const raced = await this.repository.findOne({ where: { payment_hash: paymentHash } });
        return { started: false, existing: raced ?? undefined };
      }
      throw error;
    }
  }

  async markSubmitted(paymentHash: string, txId: string): Promise<void> {
    await this.repository.update(
      { payment_hash: paymentHash },
      { status: BillingPaymentLogStatus.SUBMITTED, tx_id: txId || null },
    );
  }

  async markConfirmed(paymentHash: string, txId?: string): Promise<void> {
    await this.repository.update(
      { payment_hash: paymentHash },
      {
        status: BillingPaymentLogStatus.CONFIRMED,
        ...(txId ? { tx_id: txId } : {}),
      },
    );
  }

  async markFailed(paymentHash: string, reason: string): Promise<void> {
    await this.repository.update(
      { payment_hash: paymentHash },
      { status: BillingPaymentLogStatus.FAILED, last_error: reason.slice(0, 4000) },
    );
  }

  /** Записать ошибку, не меняя статус (зависшее SUBMITTING — для диагностики). */
  async recordError(paymentHash: string, reason: string): Promise<void> {
    await this.repository.update({ payment_hash: paymentHash }, { last_error: reason.slice(0, 4000) });
  }
}
