import { Inject, Injectable } from '@nestjs/common';
import {
  ExpenseProposalRepository,
  EXPENSE_PROPOSAL_REPOSITORY,
} from '../../domain/repositories/expense-proposal.repository';
import { ExpenseProposalDomainEntity } from '../../domain/entities/expense-proposal.entity';
import {
  PaginationInputDTO,
  PaginationResult,
} from '~/application/common/dto/pagination.dto';
import { DocumentAggregationService } from '~/domain/document/services/document-aggregation.service';
import type { DocumentDomainAggregate } from '~/domain/document/aggregates/document-domain.aggregate';

/**
 * Агрегаты подписанных документов сметы расхода: заявление + решение совета.
 *
 * Используется и в одиночном fetch'е, и в paginated-листе (агрегаты собираются
 * через batched Promise.all, на типичную страницу 10–20 смет это OK).
 */
export interface ExpenseProposalDocumentAggregates {
  statement_doc?: DocumentDomainAggregate | null;
  decision_doc?: DocumentDomainAggregate | null;
}

/**
 * Read-сервис расходов: список и просмотр смет.
 *
 * Mutation-операции (`payexp`/`reportexp`/`returnexp`) — отдельные use-case-сервисы;
 * этот сервис только читает зеркало из PG (никаких RPC-fallback'ов, см. ADR-011).
 */
@Injectable()
export class ExpensesManagementService {
  constructor(
    @Inject(EXPENSE_PROPOSAL_REPOSITORY)
    private readonly proposals: ExpenseProposalRepository,
    private readonly documentAggregation: DocumentAggregationService
  ) {}

  /**
   * Собрать агрегаты обоих документов сметы (заявление + решение совета).
   *
   * Возвращает `undefined` для отсутствующих доков, `null` — если хэш пустой
   * (см. `DocumentAggregationService.EMPTY_HASH` контракт). Это разные состояния:
   *   - `undefined` → доку не приложен / зеркало ещё не пришло;
   *   - `null` → доку приложен, но пустой хэш (пограничный случай chain-mirror).
   */
  async buildProposalDocumentAggregates(
    entity: ExpenseProposalDomainEntity
  ): Promise<ExpenseProposalDocumentAggregates> {
    const [statement_doc, decision_doc] = await Promise.all([
      entity.statement_doc
        ? this.documentAggregation.buildDocumentAggregate(entity.statement_doc)
        : Promise.resolve(undefined),
      entity.decision_doc
        ? this.documentAggregation.buildDocumentAggregate(entity.decision_doc)
        : Promise.resolve(undefined),
    ]);
    return { statement_doc, decision_doc };
  }

  async getProposalByHash(proposalHash: string): Promise<ExpenseProposalDomainEntity | null> {
    return this.proposals.findByProposalHash(proposalHash);
  }

  async listProposalsByCooperative(coopname: string): Promise<ExpenseProposalDomainEntity[]> {
    return this.proposals.findByCoopname(coopname);
  }

  async listProposalsByMember(coopname: string, username: string): Promise<ExpenseProposalDomainEntity[]> {
    return this.proposals.findByUsername(coopname, username);
  }

  async listProposalsByCooperativePaginated(
    coopname: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ExpenseProposalDomainEntity>> {
    const { items, totalCount } = await this.proposals.findByCoopnamePaginated(coopname, options);
    return this.toPaginationResult(items, totalCount, options);
  }

  async listProposalsByMemberPaginated(
    coopname: string,
    username: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<ExpenseProposalDomainEntity>> {
    const { items, totalCount } = await this.proposals.findByUsernamePaginated(coopname, username, options);
    return this.toPaginationResult(items, totalCount, options);
  }

  private toPaginationResult<T>(
    items: T[],
    totalCount: number,
    options?: PaginationInputDTO
  ): PaginationResult<T> {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.max(1, options?.limit ?? 10);
    return {
      items,
      totalCount,
      totalPages: limit > 0 ? Math.ceil(totalCount / limit) : 0,
      currentPage: page,
    };
  }
}
