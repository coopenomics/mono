import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EduAccessState, EduEnrollmentPeriod, EduEnrollmentStatus } from '../../domain/enums';

/**
 * Подписка — связка «обучающийся + курс». Оплаченный период ведётся раздельно
 * по каждой связке. `sub_hash` — ключ записи в цепи (`edubridge::edusubs`),
 * хеши хранятся в нижнем регистре.
 */
@Entity({ name: 'edubridge_enrollments' })
@Index('IDX_edubridge_enrollments_unique', ['coopname', 'learner_id', 'course_id'], { unique: true })
@Index('IDX_edubridge_enrollments_sub_hash', ['sub_hash'], { unique: true })
@Index('IDX_edubridge_enrollments_paid_until', ['coopname', 'status', 'paid_until'])
export class EdubridgeEnrollmentEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public member_username!: string;

  @Column({ type: 'uuid' })
  public learner_id!: string;

  @Column({ type: 'uuid' })
  public course_id!: string;

  @Column({ type: 'varchar', length: 64 })
  public sub_hash!: string;

  @Column({ type: 'enum', enum: EduEnrollmentPeriod })
  public period!: EduEnrollmentPeriod;

  @Column({ type: 'timestamptz', nullable: true })
  public paid_until!: Date | null;

  @Column({ type: 'enum', enum: EduEnrollmentStatus, default: EduEnrollmentStatus.PENDING })
  public status!: EduEnrollmentStatus;

  @Column({ type: 'enum', enum: EduAccessState, default: EduAccessState.NONE })
  public access_state!: EduAccessState;

  /** Уплаченный взнос за текущий период — от него считается возврат при отмене. */
  @Column({ type: 'varchar', length: 64, default: '0.0000 RUB' })
  public paid_amount!: string;

  /** Месяцев оплачено текущим взносом: один при помесячном, месяцы до конца курса при взносе разом. */
  @Column({ type: 'int', nullable: true })
  public paid_months!: number | null;

  /**
   * Сколько из оплаченного удержано. Правило одно: удержано не меньше того, что
   * участник может потребовать назад прямо сейчас. Пока идёт гарантийный срок
   * курса — это весь взнос; после него удержание тает вместе с возвратной
   * суммой по Положению. Лишнее освобождает очередь, остаток — отмена и
   * закрытие подписки.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  public locked_amount!: string | null;

  /** Когда подписка отменена; null — действует или истекла сама. */
  @Column({ type: 'timestamptz', nullable: true })
  public cancelled_at!: Date | null;

  /** Сколько вернули ученику при отмене. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  public refunded_amount!: string | null;

  /** Основание возврата по Положению ЦПП: до активации, по недобору, отказ в ходе подписки. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  public refund_reason!: string | null;

  /** Хеш последнего заявления о конвертации (док. 3011), lowercase. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  public statement_hash!: string | null;

  /** Когда отправлено предупреждение о предстоящем отзыве; null — не отправлялось для текущего периода. */
  @Column({ type: 'timestamptz', nullable: true })
  public expiry_notified_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
