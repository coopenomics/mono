import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { CommitStatus } from '../../domain/enums/commit-status.enum';
import type { ICommitBlockchainData } from '../../domain/interfaces/commit-blockchain.interface';
import type { CommitData } from '../../domain/entities/commit.entity';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';
import { ContributorTypeormEntity } from './contributor.typeorm-entity';

export const EntityName = 'capital_commits';
@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_commit_hash`, ['commit_hash'])
@Index(`idx_${EntityName}_project_hash`, ['project_hash'])
@Index(`idx_${EntityName}_username`, ['username'])
@Index(`idx_${EntityName}_status`, ['status'])
@Index(`idx_${EntityName}_created_at`, ['_created_at'])
export class CommitTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }
  @Column({ type: 'integer', nullable: true, unique: true })
  id!: number;

  // Поля из блокчейна (commits.hpp)
  @Column({ type: 'varchar', length: 12, nullable: true })
  coopname!: string;

  @Column({ type: 'varchar', length: 12, nullable: true })
  username!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  project_hash!: string;

  @Column({ type: 'varchar', length: 64 })
  commit_hash!: string;

  @Column({ type: 'json', nullable: true })
  amounts!: ICommitBlockchainData['amounts'];

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'text', nullable: true })
  meta!: string;

  @Column({ type: 'jsonb', nullable: true })
  data!: CommitData | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  blockchain_status!: string;

  @Column({ type: 'timestamp', nullable: true })
  created_at!: Date;

  // Доменные поля (расширения)
  @Column({
    type: 'enum',
    enum: CommitStatus,
    default: CommitStatus.CREATED,
  })
  status!: CommitStatus;

  // Связь с участником для получения display_name
  @ManyToOne(() => ContributorTypeormEntity, { nullable: true })
  @JoinColumn([
    { name: 'coopname', referencedColumnName: 'coopname' },
    { name: 'username', referencedColumnName: 'username' },
  ])
  contributor?: ContributorTypeormEntity;
}
