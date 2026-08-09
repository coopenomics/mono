import { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { ExpenseDomainEntity } from '../entities/expense.entity';
import type { ExpenseFilterInputDTO } from '../../application/dto/expenses_management/expense-filter.input';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

export interface ExpenseRepository extends IBlockchainSyncRepository<ExpenseDomainEntity> {
  create(expense: Omit<ExpenseDomainEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExpenseDomainEntity>;
  findById(_id: string): Promise<ExpenseDomainEntity | null>;
  findAll(): Promise<ExpenseDomainEntity[]>;
  findByUsername(username: string): Promise<ExpenseDomainEntity[]>;
  findByProjectHash(projectHash: string): Promise<ExpenseDomainEntity[]>;
  findByStatus(status: string): Promise<ExpenseDomainEntity[]>;
  findAllPaginated(
    filter?: ExpenseFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ExpenseDomainEntity>>;
  update(entity: ExpenseDomainEntity): Promise<ExpenseDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const EXPENSE_REPOSITORY = Symbol('ExpenseRepository');
