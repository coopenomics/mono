import { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { InvestDomainEntity } from '../entities/invest.entity';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { InvestFilterInputDTO } from '../../application/dto/invests_management/invest-filter.input';

export interface InvestRepository extends IBlockchainSyncRepository<InvestDomainEntity> {
  create(invest: Omit<InvestDomainEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<InvestDomainEntity>;
  findById(_id: string): Promise<InvestDomainEntity | null>;
  findAll(): Promise<InvestDomainEntity[]>;
  findByUsername(username: string): Promise<InvestDomainEntity[]>;
  findByProjectHash(projectHash: string): Promise<InvestDomainEntity[]>;
  findByStatus(status: string): Promise<InvestDomainEntity[]>;
  findAllPaginated(
    filter?: InvestFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<InvestDomainEntity>>;
  update(entity: InvestDomainEntity): Promise<InvestDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const INVEST_REPOSITORY = Symbol('InvestRepository');
