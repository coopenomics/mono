import { Entity, Column, Index } from 'typeorm';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

/**
 * Открытая/закрытая сессия таймера участника (максимум одна открытая на contributor).
 */
@Entity('capital_timer_sessions')
@Index(['contributor_hash', 'stopped_at'])
export class TimerSessionEntity extends BaseTypeormEntity {
  @Column({ type: 'varchar', length: 64 })
  @Index()
  contributor_hash!: string;

  @Column({ type: 'varchar', length: 64 })
  @Index()
  issue_hash!: string;

  @Column({ type: 'varchar', length: 64 })
  project_hash!: string;

  @Column({ type: 'varchar', length: 64 })
  coopname!: string;

  @Column({ type: 'timestamptz' })
  started_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  stopped_at?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paused_at?: Date | null;

  @Column({ type: 'bigint', default: 0 })
  total_paused_ms!: number;
}
