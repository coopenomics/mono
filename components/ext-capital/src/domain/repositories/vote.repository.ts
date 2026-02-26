import { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { VoteDomainEntity } from '../entities/vote.entity';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { VoteFilterInputDTO } from '../../application/dto/voting/vote-filter.input';

export interface VoteRepository extends IBlockchainSyncRepository<VoteDomainEntity> {
  create(vote: Omit<VoteDomainEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<VoteDomainEntity>;
  findById(_id: string): Promise<VoteDomainEntity | null>;
  findAll(): Promise<VoteDomainEntity[]>;
  findByVoter(voter: string): Promise<VoteDomainEntity[]>;
  findByRecipient(recipient: string): Promise<VoteDomainEntity[]>;
  findByProjectHash(projectHash: string): Promise<VoteDomainEntity[]>;
  findByCoopname(coopname: string): Promise<VoteDomainEntity[]>;
  findAllPaginated(
    filter?: VoteFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<VoteDomainEntity>>;
  update(entity: VoteDomainEntity): Promise<VoteDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const VOTE_REPOSITORY = Symbol('VoteRepository');
