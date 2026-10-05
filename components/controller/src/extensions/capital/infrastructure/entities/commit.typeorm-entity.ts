import { CommitStatus } from '../../domain/enums/commit-status.enum';
import type { ICommitBlockchainData } from '../../domain/interfaces/commit-blockchain.interface';
import type { CommitData } from '../../domain/entities/commit.entity';
import { ChainRecord } from '@coopenomics/extension-kit/sync';
import { ContributorTypeormEntity } from './contributor.typeorm-entity';

export const EntityName = 'capital_commits';
export class CommitTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }
  id!: number;

  // Поля из блокчейна (commits.hpp)
  coopname!: string;

  username!: string;

  project_hash!: string;

  commit_hash!: string;

  amounts!: ICommitBlockchainData['amounts'];

  description!: string;

  meta!: string;

  data!: CommitData | null;

  blockchain_status!: string;

  created_at!: Date;

  // Доменные поля (расширения)
  status!: CommitStatus;

  // Связь с участником для получения display_name
  contributor?: ContributorTypeormEntity;
}
