import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EduAccessCarrier, EduAccessTaskKind, EduAccessTaskStatus } from '../../domain/enums';

/**
 * Outbox выдачи/отзыва доступа. Задача переживает перезапуск и повторяется
 * до успеха (backoff 1→60 мин, N попыток → needs_attention). Дедупликация —
 * по `(kind, enrollment_id, trigger_trx)`.
 */
@Entity({ name: 'edubridge_access_tasks' })
@Index('IDX_edubridge_access_tasks_due', ['coopname', 'status', 'next_attempt_at'])
@Index('IDX_edubridge_access_tasks_dedup', ['kind', 'enrollment_id', 'trigger_trx'], { unique: true })
export class EdubridgeAccessTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'uuid' })
  public enrollment_id!: string;

  @Column({ type: 'enum', enum: EduAccessTaskKind })
  public kind!: EduAccessTaskKind;

  @Column({ type: 'enum', enum: EduAccessCarrier })
  public carrier!: EduAccessCarrier;

  /** Идентификатор транзакции цепи или иного триггера (например `manual:<uuid>`). */
  @Column({ type: 'varchar', length: 80 })
  public trigger_trx!: string;

  @Column({ type: 'enum', enum: EduAccessTaskStatus, default: EduAccessTaskStatus.PENDING })
  public status!: EduAccessTaskStatus;

  @Column({ type: 'int', default: 0 })
  public attempts!: number;

  @Column({ type: 'timestamptz' })
  public next_attempt_at!: Date;

  @Column({ type: 'text', nullable: true })
  public last_error!: string | null;

  /** Код результата коннектора: ok | retryable | fatal | exists. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  public last_result!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  public done_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
