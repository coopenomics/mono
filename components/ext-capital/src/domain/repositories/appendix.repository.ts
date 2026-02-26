import { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { AppendixDomainEntity } from '../entities/appendix.entity';

export interface AppendixRepository extends IBlockchainSyncRepository<AppendixDomainEntity> {
  findByAppendixHash(appendixHash: string): Promise<AppendixDomainEntity | null>;
  save(entity: AppendixDomainEntity): Promise<AppendixDomainEntity>;
  findConfirmedByUsernameAndProjectHash(username: string, projectHash: string): Promise<AppendixDomainEntity | null>;
  findCreatedByUsernameAndProjectHash(username: string, projectHash: string): Promise<AppendixDomainEntity | null>;
}

export const APPENDIX_REPOSITORY = Symbol('AppendixRepository');
