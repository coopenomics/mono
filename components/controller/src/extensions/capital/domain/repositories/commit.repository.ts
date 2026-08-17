import { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { CommitDomainEntity } from '../entities/commit.entity';
import type { CommitFilterInputDTO } from '../../application/dto/generation/commit-filter.input';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

export interface CommitRepository extends IBlockchainSyncRepository<CommitDomainEntity> {
  findById(_id: string): Promise<CommitDomainEntity | null>;
  findByCommitHash(commitHash: string): Promise<CommitDomainEntity | null>;
  findAll(): Promise<CommitDomainEntity[]>;
  findByUsername(username: string): Promise<CommitDomainEntity[]>;
  findByProjectHash(projectHash: string): Promise<CommitDomainEntity[]>;
  findByStatus(status: string): Promise<CommitDomainEntity[]>;
  findAllPaginated(
    filter?: CommitFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<CommitDomainEntity>>;
  update(entity: CommitDomainEntity): Promise<CommitDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const COMMIT_REPOSITORY = Symbol('CommitRepository');
