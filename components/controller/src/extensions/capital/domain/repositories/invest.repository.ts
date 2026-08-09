import { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { InvestDomainEntity } from '../entities/invest.entity';
import type { InvestFilterInputDTO } from '../../application/dto/invests_management/invest-filter.input';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

export interface InvestRepository extends IBlockchainSyncRepository<InvestDomainEntity> {
  create(invest: Omit<InvestDomainEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<InvestDomainEntity>;
  findById(_id: string): Promise<InvestDomainEntity | null>;
  findAll(): Promise<InvestDomainEntity[]>;
  findByUsername(username: string): Promise<InvestDomainEntity[]>;
  findByProjectHash(projectHash: string): Promise<InvestDomainEntity[]>;
  findByStatus(status: string): Promise<InvestDomainEntity[]>;
  findAllPaginated(
    filter?: InvestFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<InvestDomainEntity>>;
  update(entity: InvestDomainEntity): Promise<InvestDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const INVEST_REPOSITORY = Symbol('InvestRepository');
