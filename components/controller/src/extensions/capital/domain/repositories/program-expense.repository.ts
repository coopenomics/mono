import { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { ProgramExpenseDomainEntity } from '../entities/program-expense.entity';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { ProgramExpenseFilterInputDTO } from '../../application/dto/program_expenses_management/program-expense-filter.input';

export interface ProgramExpenseRepository extends IBlockchainSyncRepository<ProgramExpenseDomainEntity> {
  create(
    expense: Omit<ProgramExpenseDomainEntity, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ProgramExpenseDomainEntity>;
  findById(_id: string): Promise<ProgramExpenseDomainEntity | null>;
  findAll(): Promise<ProgramExpenseDomainEntity[]>;
  findByUsername(username: string): Promise<ProgramExpenseDomainEntity[]>;
  findByStatus(status: string): Promise<ProgramExpenseDomainEntity[]>;
  findAllPaginated(
    filter?: ProgramExpenseFilterInputDTO,
    options?: PaginationInputDomainInterface,
  ): Promise<PaginationResultDomainInterface<ProgramExpenseDomainEntity>>;
  update(entity: ProgramExpenseDomainEntity): Promise<ProgramExpenseDomainEntity>;
  delete(_id: string): Promise<void>;
}

export const PROGRAM_EXPENSE_REPOSITORY = Symbol('ProgramExpenseRepository');
