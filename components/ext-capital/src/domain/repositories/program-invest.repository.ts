import { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { ProgramInvestDomainEntity } from '../entities/program-invest.entity';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { InvestFilterInputDTO } from '../../application/dto/invests_management/invest-filter.input';

export interface ProgramInvestRepository extends IBlockchainSyncRepository<ProgramInvestDomainEntity> {
  findById(_id: string): Promise<ProgramInvestDomainEntity | null>;
  findAllPaginated(
    filter?: InvestFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ProgramInvestDomainEntity>>;
}

export const PROGRAM_INVEST_REPOSITORY = Symbol('ProgramInvestRepository');
