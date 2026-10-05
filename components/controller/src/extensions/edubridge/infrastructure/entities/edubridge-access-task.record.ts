import { EduAccessCarrier, EduAccessTaskKind, EduAccessTaskStatus } from '../../domain/enums';

/**
 * Outbox выдачи/отзыва доступа. Задача переживает перезапуск и повторяется
 * до успеха (backoff 1→60 мин, N попыток → needs_attention). Дедупликация —
 * по `(kind, enrollment_id, trigger_trx)`.
 */
export class EdubridgeAccessTaskRecord {
  public id!: string;

  public coopname!: string;

  public enrollment_id!: string;

  public kind!: EduAccessTaskKind;

  public carrier!: EduAccessCarrier;

  /** Идентификатор транзакции цепи или иного триггера (например `manual:<uuid>`). */
  public trigger_trx!: string;

  /** Переопределение получателя (при смене контакта отзываем старый адрес). */
  public recipient_override!: { type: string; value: string } | null;

  public status!: EduAccessTaskStatus;

  public attempts!: number;

  public next_attempt_at!: Date;

  public last_error!: string | null;

  /** Код результата коннектора: ok | retryable | fatal | exists. */
  public last_result!: string | null;

  public done_at!: Date | null;

  public created_at!: Date;

  public updated_at!: Date;
}
