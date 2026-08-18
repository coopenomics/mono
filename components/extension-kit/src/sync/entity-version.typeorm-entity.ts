import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * Единая таблица для хранения версий всех сущностей системы.
 * Используется для восстановления состояния при форках блокчейна.
 */
@Entity('entity_versions')
@Index('idx_entity_versions_entity_table_id', ['entity_table', 'entity_id'])
@Index('idx_entity_versions_block_num', ['block_num'])
export class EntityVersionTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Название таблицы сущности (например, 'chairman_approvals')
   */
  @Column({ type: 'varchar', length: 100 })
  entity_table!: string;

  /**
   * ID сущности в её таблице (_id для TypeORM сущностей)
   */
  @Column({ type: 'varchar', length: 36 })
  entity_id!: string;

  /**
   * Полные данные предыдущей версии сущности в JSON формате
   */
  @Column({ type: 'jsonb' })
  previous_data!: Record<string, any>;

  /**
   * Номер блока, на котором произошло изменение
   */
  @Column({ type: 'integer', nullable: true })
  block_num?: number | null;

  /**
   * Тип изменения (blockchain_sync, local_change и т.д.)
   */
  @Column({ type: 'varchar', length: 50 })
  change_type!: string;

  /**
   * Дополнительные метаданные изменения
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;
}
