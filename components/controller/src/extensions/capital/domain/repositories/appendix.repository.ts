import { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { AppendixDomainEntity } from '../entities/appendix.entity';

export interface AppendixRepository extends IBlockchainSyncRepository<AppendixDomainEntity> {
  findByAppendixHash(appendixHash: string): Promise<AppendixDomainEntity | null>;
  save(entity: AppendixDomainEntity): Promise<AppendixDomainEntity>;
  findConfirmedByUsernameAndProjectHash(username: string, projectHash: string): Promise<AppendixDomainEntity | null>;
  findCreatedByUsernameAndProjectHash(username: string, projectHash: string): Promise<AppendixDomainEntity | null>;
  /** Уникальные username с подтверждённым допуском к проекту */
  findDistinctUsernamesWithConfirmedClearanceByProjectHash(projectHash: string): Promise<string[]>;
  /** Уникальные project_hash с подтверждённым допуском у пользователя */
  findDistinctProjectHashesWithConfirmedClearanceByUsername(username: string): Promise<string[]>;
}

export const APPENDIX_REPOSITORY = Symbol('AppendixRepository');
