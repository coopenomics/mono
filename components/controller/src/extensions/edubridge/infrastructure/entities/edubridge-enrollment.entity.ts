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
