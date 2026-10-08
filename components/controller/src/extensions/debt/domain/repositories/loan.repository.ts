import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type { PaginationInputDTO } from '@coopenomics/extension-kit';
import type { LoanDomainEntity } from '../entities/loan.entity';
import type { LoanStatus } from '../enums/loan-status.enum';

export interface LoanListFilter {
  coopname: string;
  username?: string;
  status?: LoanStatus;
  source?: string;
}

/** Репозиторий зеркала займов. Чтение — только из Postgres. */
export interface LoanRepository extends IBlockchainSyncRepository<LoanDomainEntity> {
  findByDebtHash(debtHash: string): Promise<LoanDomainEntity | null>;
  findByUsername(coopname: string, username: string): Promise<LoanDomainEntity[]>;
  findPaginated(
    filter: LoanListFilter,
    options?: PaginationInputDTO
  ): Promise<{ items: LoanDomainEntity[]; totalCount: number }>;
}

export const LOAN_REPOSITORY = Symbol('DebtLoanRepository');
