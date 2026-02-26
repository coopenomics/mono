import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * TypeORM сущность для индекса файлов GitHub
 * Хранит маппинг между сущностями БД и файлами в GitHub репозитории
 */
export const EntityName = 'github_file_indexes';

@Entity(EntityName)
@Index(`idx_${EntityName}_entity`, ['coopname', 'entity_type', 'entity_hash'], { unique: true })
@Index(`idx_${EntityName}_file_path`, ['coopname', 'file_path'])
@Index(`idx_${EntityName}_coopname`, ['coopname'])
export class GitHubFileIndexTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  coopname!: string;

  @Column({ type: 'varchar', length: 20 })
  entity_type!: 'project' | 'issue' | 'story' | 'result';

  @Column({ type: 'varchar', length: 64 })
  entity_hash!: string;

  @Column({ type: 'text' })
  file_path!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  github_sha?: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  last_synced_at!: Date;
}
