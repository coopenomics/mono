import { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { DebtDomainEntity } from '../entities/debt.entity';
import type { DebtFilterInputDTO } from '../../application/dto/debt_management/debt-filter.input';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

export interface DebtRepository extends IBlockchainSyncRepository<DebtDomainEntity> {
  create(debt: Omit<DebtDomainEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<DebtDomainEntity>;
  findById(_id: string): Promise<DebtDomainEntity | null>;
  findAll(): Promise<DebtDomainEntity[]>;
  findByUsername(username: string): Promise<DebtDomainEntity[]>;
  findByProjectHash(projectHash: string): Promise<DebtDomainEntity[]>;
  findByStatus(status: string): Promise<DebtDomainEntity[]>;
  /** Список ссуд с отбором по пайщику, проекту и статусу — постранично. */
  findAllPaginated(filter?: DebtFilterInputDTO, options?: PaginationInputDTO): Promise<PaginationResult<DebtDomainEntity>>;
  update(entity: DebtDomainEntity): Promise<DebtDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const DEBT_REPOSITORY = Symbol('DebtRepository');
