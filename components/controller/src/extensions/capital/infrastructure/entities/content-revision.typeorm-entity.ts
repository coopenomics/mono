import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { ContentEntityType } from '../../domain/enums/content-entity-type.enum';
import { ContentRevisionOrigin } from '../../domain/enums/content-revision-origin.enum';

export const EntityName = 'capital_content_revisions';

/**
 * Снимок содержимого (title + description) сущности на момент каждой успешной записи.
 * Номер `rev` монотонный в пределах (entity_type, entity_hash); растёт только от содержательной правки,
 * синхронизация из цепи и дочерние мутации его не двигают.
 */
@Entity(EntityName)
@Index(`idx_${EntityName}_entity_rev`, ['entity_type', 'entity_hash', 'rev'], { unique: true })
@Index(`idx_${EntityName}_entity_created`, ['entity_type', 'entity_hash', 'created_at'])
export class ContentRevisionTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  _id!: string;

  @Column({ type: 'varchar', length: 16 })
  entity_type!: ContentEntityType;

  @Column({ type: 'varchar', length: 64 })
  entity_hash!: string;

  @Column({ type: 'integer' })
  rev!: number;

  /** Редакция, с которой автор начал правку (для трассировки слияний). */
  @Column({ type: 'integer', nullable: true })
  base_rev?: number | null;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  content_format?: string | null;

  @Column({ type: 'varchar', length: 64 })
  content_hash!: string;

  @Column({ type: 'varchar', length: 64 })
  author!: string;

  @Column({ type: 'varchar', length: 16 })
  origin!: ContentRevisionOrigin;

  /** Для origin=RESTORE — номер редакции, к которой откатились. */
  @Column({ type: 'integer', nullable: true })
  restored_from_rev?: number | null;

  /** true — текст получен трёхсторонним слиянием с параллельной правкой. */
  @Column({ type: 'boolean', default: false })
  merged!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;
}
