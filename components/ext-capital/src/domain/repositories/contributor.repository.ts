import { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { ContributorDomainEntity } from '../entities/contributor.entity';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { ContributorFilterInputDTO } from '../../application/dto/participation_management/contributor-filter.input';
import { ContributorStatus } from '../enums/contributor-status.enum';

export interface ContributorRepository extends IBlockchainSyncRepository<ContributorDomainEntity> {
  create(contributor: Omit<ContributorDomainEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContributorDomainEntity>;
  findById(_id: string): Promise<ContributorDomainEntity | null>;
  findAll(): Promise<ContributorDomainEntity[]>;
  findByUsername(username: string): Promise<ContributorDomainEntity | null>;
  findByUsernameAndCoopname(username: string, coopname: string): Promise<ContributorDomainEntity | null>;
  findByStatusAndCoopname(status: ContributorStatus, coopname: string): Promise<ContributorDomainEntity[]>;
  findByHashesAndStatus(contributorHashes: string[], status: ContributorStatus): Promise<ContributorDomainEntity[]>;
  findByStatus(status: string): Promise<ContributorDomainEntity[]>;
  findAllPaginated(
    filter?: ContributorFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ContributorDomainEntity>>;
  /**
   * Поиск contributor по любому из полей: _id, username, contributor_hash
   * Возвращает первого найденного contributor
   */
  findOne(criteria: { _id?: string; username?: string; contributor_hash?: string }): Promise<ContributorDomainEntity | null>;
  update(entity: ContributorDomainEntity): Promise<ContributorDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const CONTRIBUTOR_REPOSITORY = Symbol('ContributorRepository');
