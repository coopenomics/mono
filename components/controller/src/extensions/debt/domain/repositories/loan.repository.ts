import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type { PaginationInputDTO } from '@coopenomics/extension-kit';
import type { LoanDomainEntity } from '../entities/loan.entity';
import type { LoanStatus } from '../enums/loan-status.enum';

export interface LoanListFilter {
  coopname: string;
  username?: string;
  status?: LoanStatus;
  source?: string;
  /** Только выданные и не закрытые: в срок и в просрочке. */
  outstanding?: boolean;
  /** Выданные займы, срок которых наступает в ближайшие столько дней. */
  due_within_days?: number;
}

/** Репозиторий зеркала займов. Чтение — только из Postgres. */
export interface LoanRepository extends IBlockchainSyncRepository<LoanDomainEntity> {
  findByDebtHash(debtHash: string): Promise<LoanDomainEntity | null>;
  findByUsername(coopname: string, username: string): Promise<LoanDomainEntity[]>;
  findByStatus(coopname: string, status: LoanStatus): Promise<LoanDomainEntity[]>;
  findPaginated(
    filter: LoanListFilter,
    options?: PaginationInputDTO
  ): Promise<{ items: LoanDomainEntity[]; totalCount: number }>;
}

export const LOAN_REPOSITORY = Symbol('DebtLoanRepository');
