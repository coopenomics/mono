import { EduAccessState, EduEnrollmentPeriod, EduEnrollmentStatus } from '../../domain/enums';

/**
 * Подписка — связка «обучающийся + курс». Оплаченный период ведётся раздельно
 * по каждой связке. `sub_hash` — ключ записи в цепи (`edubridge::edusubs`),
 * хеши хранятся в нижнем регистре.
 */
export class EdubridgeEnrollmentEntity {
  public id!: string;

  public coopname!: string;

  public member_username!: string;

  public learner_id!: string;

  public course_id!: string;

  public sub_hash!: string;

  public period!: EduEnrollmentPeriod;

  public paid_until!: Date | null;

  public status!: EduEnrollmentStatus;

  public access_state!: EduAccessState;

  /** Уплаченный взнос за текущий период — от него считается возврат при отмене. */
  public paid_amount!: string;

  /** Месяцев оплачено текущим взносом: один при помесячном, месяцы до конца курса при взносе разом. */
  public paid_months!: number | null;

  /**
   * Сколько из оплаченного удержано. Правило одно: удержано не меньше того, что
   * участник может потребовать назад прямо сейчас. Пока идёт его гарантийный
   * срок — это весь взнос; после него удержание тает вместе с возвратной
   * суммой по Положению. Лишнее освобождает очередь, остаток — отмена и
   * закрытие подписки.
   */
  public locked_amount!: string | null;

  /**
   * Когда ученик вписался в курс — открыл подписку. От более поздней из этой
   * даты и начала занятий идёт его гарантийный срок; продление её не меняет.
   */
  public joined_at!: Date | null;

  /** Когда подписка отменена; null — действует или истекла сама. */
  public cancelled_at!: Date | null;

  /** Сколько вернули ученику при отмене. */
  public refunded_amount!: string | null;

  /** Основание возврата по Положению ЦПП: до активации, по недобору, отказ в ходе подписки. */
  public refund_reason!: string | null;

  /** Хеш последнего заявления о конвертации (док. 3011), lowercase. */
  public statement_hash!: string | null;

  /** Когда отправлено предупреждение о предстоящем отзыве; null — не отправлялось для текущего периода. */
  public expiry_notified_at!: Date | null;

  public created_at!: Date;

  public updated_at!: Date;
}
