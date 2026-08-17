import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type { PaginationInputDTO } from '@coopenomics/extension-kit';
import type { ExpenseProposalDomainEntity } from '../entities/expense-proposal.entity';

/**
 * Репозиторий зеркала СЗ-расходов. Чтение строго из Postgres
 * (ADR-011 — read-path); chain RPC только для reconciliation / forensic.
 *
 * `*Paginated` методы — каноничный путь для resolver'ов (см. controller/CLAUDE.md
 * «Пагинация — единый паттерн»). Неснабжённые пагинацией методы оставлены для
 * внутреннего DocumentAggregation / e2e и постепенно вытесняются.
 */
export interface ExpenseProposalRepository extends IBlockchainSyncRepository<ExpenseProposalDomainEntity> {
  findByProposalHash(proposalHash: string): Promise<ExpenseProposalDomainEntity | null>;
  findByCoopname(coopname: string): Promise<ExpenseProposalDomainEntity[]>;
  findByUsername(coopname: string, username: string): Promise<ExpenseProposalDomainEntity[]>;

  findByCoopnamePaginated(
    coopname: string,
    options?: PaginationInputDTO
  ): Promise<{ items: ExpenseProposalDomainEntity[]; totalCount: number }>;
  findByUsernamePaginated(
    coopname: string,
    username: string,
    options?: PaginationInputDTO
  ): Promise<{ items: ExpenseProposalDomainEntity[]; totalCount: number }>;
}

export const EXPENSE_PROPOSAL_REPOSITORY = Symbol('ExpenseProposalRepository');
