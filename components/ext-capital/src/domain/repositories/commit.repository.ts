import { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { CommitDomainEntity } from '../entities/commit.entity';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { CommitFilterInputDTO } from '../../application/dto/generation/commit-filter.input';

export interface CommitRepository extends IBlockchainSyncRepository<CommitDomainEntity> {
  findById(_id: string): Promise<CommitDomainEntity | null>;
  findByCommitHash(commitHash: string): Promise<CommitDomainEntity | null>;
  findAll(): Promise<CommitDomainEntity[]>;
  findByUsername(username: string): Promise<CommitDomainEntity[]>;
  findByProjectHash(projectHash: string): Promise<CommitDomainEntity[]>;
  findByStatus(status: string): Promise<CommitDomainEntity[]>;
  findAllPaginated(
    filter?: CommitFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<CommitDomainEntity>>;
  update(entity: CommitDomainEntity): Promise<CommitDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const COMMIT_REPOSITORY = Symbol('CommitRepository');
