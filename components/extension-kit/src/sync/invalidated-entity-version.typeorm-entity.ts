import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * Архив версий-снимков, потерявших инвалидирующий блок при форке. Story 4.4.
 *
 * Каждый ряд entity_versions хранит previous_data + block_num (блок, в котором данное
 * previous_data перестало быть актуальным). При форке на N все entity_versions
 * WHERE block_num > N теряют свой инвалидирующий блок (он на снесённой ветке) и
 * становятся «осиротевшими». Если не убрать — при повторном форке restoreFromVersions
 * подберёт их и поднимет не ту ветку.
 *
 * `original_block_num` = блок-инвалидатор из исходного entity_versions ряда (может быть null
 * для локальных pre-blockchain изменений). `invalidated_by_block` = блок форка.
 */
@Entity('invalidated_entity_versions')
@Index('idx_invalidated_versions_block', ['invalidated_by_block'])
@Index('idx_invalidated_versions_fork_event', ['fork_event_id'])
@Index('idx_invalidated_versions_table_id', ['entity_table', 'entity_id'])
export class InvalidatedEntityVersionTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  entity_table!: string;

  @Column({ type: 'varchar', length: 64 })
  entity_id!: string;

  @Column({ type: 'jsonb' })
  previous_data!: Record<string, any>;

  @Column({ type: 'integer', nullable: true })
  original_block_num?: number | null;

  @Column({ type: 'integer' })
  invalidated_by_block!: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  fork_event_id?: string | null;

  @Column({ type: 'varchar', length: 50 })
  change_type!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;
}
