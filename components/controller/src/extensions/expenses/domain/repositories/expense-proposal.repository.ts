import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import type { PaginationInputDTO } from '~/application/common/dto/pagination.dto';
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
