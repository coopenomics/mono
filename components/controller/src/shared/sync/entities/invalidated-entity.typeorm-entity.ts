import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * Архив сущностей, снесённых форком. Каждый ряд = одна live-запись, которая была
 * в зеркале блокчейна на момент форка (block_num > forkBlockNum). Story 4.4.
 *
 * `invalidated_by_block` = block_num форка (т.е. forked_from_block из ForkEvent).
 * `fork_event_id` группирует все снесённые одним форком ряды (опционально — старые форки до Story 4.4 без id).
 *
 * Retention: BlockchainArchiveRetentionService раз в час удаляет WHERE invalidated_by_block < LIB - 1000.
 */
@Entity('invalidated_entities')
@Index('idx_invalidated_entities_block', ['invalidated_by_block'])
@Index('idx_invalidated_entities_fork_event', ['fork_event_id'])
@Index('idx_invalidated_entities_table_id', ['entity_table', 'entity_id'])
export class InvalidatedEntityTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  entity_table!: string;

  @Column({ type: 'varchar', length: 64 })
  entity_id!: string;

  @Column({ type: 'jsonb' })
  data!: Record<string, any>;

  @Column({ type: 'integer' })
  invalidated_by_block!: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  fork_event_id?: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;
}
