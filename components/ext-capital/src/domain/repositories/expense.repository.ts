import { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { ExpenseDomainEntity } from '../entities/expense.entity';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { ExpenseFilterInputDTO } from '../../application/dto/expenses_management/expense-filter.input';

export interface ExpenseRepository extends IBlockchainSyncRepository<ExpenseDomainEntity> {
  create(expense: Omit<ExpenseDomainEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExpenseDomainEntity>;
  findById(_id: string): Promise<ExpenseDomainEntity | null>;
  findAll(): Promise<ExpenseDomainEntity[]>;
  findByUsername(username: string): Promise<ExpenseDomainEntity[]>;
  findByProjectHash(projectHash: string): Promise<ExpenseDomainEntity[]>;
  findByStatus(status: string): Promise<ExpenseDomainEntity[]>;
  findAllPaginated(
    filter?: ExpenseFilterInputDTO,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<ExpenseDomainEntity>>;
  update(entity: ExpenseDomainEntity): Promise<ExpenseDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const EXPENSE_REPOSITORY = Symbol('ExpenseRepository');
