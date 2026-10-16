import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import type { PaginationInputDTO } from '@coopenomics/extension-kit';
import type { ExpenseProposalDomainEntity } from '../entities/expense-proposal.entity';
import type { IExpenseItemBlockchainData } from '../interfaces/expense-proposal-blockchain.interface';

/**
 * Отбор строк-авансов: статусы строки в цепи и, при необходимости, только
 * перечисленные строки либо все, кроме перечисленных (по хешу строки).
 */
export interface IExpenseAdvanceQuery {
  statuses: number[];
  onlyItems?: string[];
  exceptItems?: string[];
}

/** Строка-аванс вместе с запиской, в которой она стоит. */
export interface IExpenseAdvanceRow {
  proposal_hash: string;
  item: IExpenseItemBlockchainData;
}

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
  /** Строки-авансы записок кооператива по отбору; одна строка ответа — один аванс. */
  findAdvances(
    coopname: string,
    query: IExpenseAdvanceQuery,
    options?: PaginationInputDTO
  ): Promise<{ items: IExpenseAdvanceRow[]; totalCount: number }>;
}

export const EXPENSE_PROPOSAL_REPOSITORY = Symbol('ExpenseProposalRepository');
