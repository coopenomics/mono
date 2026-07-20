import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import {
  createPaginationResult,
  PaginationInputDTO,
  PaginationResult,
} from '~/application/common/dto/pagination.dto';
import { ExpensesManagementService } from '../services/expenses-management.service';
import { ExpenseRequisiteSnapshotsService } from '../services/expense-requisite-snapshots.service';
import { ExpenseProposalOutputDTO } from '../dto/expense-proposal.output';
import { ExpenseRequisiteOutputDTO } from '../dto/expense-requisite.output';
import type { ExpenseProposalDomainEntity } from '../../domain/entities/expense-proposal.entity';

const paginatedExpenseProposalsResult = createPaginationResult(
  ExpenseProposalOutputDTO,
  'PaginatedExpenseProposals'
);

/**
 * GraphQL-резолвер чтения смет расходов (контракт `expense`).
 *
 * Read-only: read-path тянется из PG-зеркала (см. ADR-011 в controller/CLAUDE.md).
 * Mutation-резолвер (payexp/reportexp/returnexp/submitReport) — `ExpenseMutationsResolver`.
 *
 * Пагинация — единый паттерн controller'а (см. controller/CLAUDE.md «Пагинация — единый паттерн»):
 * input `PaginationInputDTO`, выход `PaginationResult<T>` через `createPaginationResult`.
 *
 * Документы (заявление + решение совета) выгружаются как полные `DocumentAggregate`
 * через `ExpensesManagementService.buildProposalDocumentAggregates(entity)`.
 */
@Resolver(() => ExpenseProposalOutputDTO)
export class ExpenseProposalResolver {
  constructor(
    private readonly expenses: ExpensesManagementService,
    private readonly requisiteSnapshots: ExpenseRequisiteSnapshotsService
  ) {}

  @Query(() => [ExpenseRequisiteOutputDTO], {
    name: 'expenseRequisitesByProposal',
    description:
      'Снимки реквизитов получателей по строкам СЗ (персональные данные — только совету; в блокчейн не пишутся).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getExpenseRequisitesByProposal(
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('proposal_hash', { type: () => String }) proposalHash: string
  ): Promise<ExpenseRequisiteOutputDTO[]> {
    const items = await this.requisiteSnapshots.listByProposal(coopname, proposalHash);
    return items.map((e) => ExpenseRequisiteOutputDTO.fromEntity(e));
  }

  @Query(() => ExpenseProposalOutputDTO, {
    name: 'expenseProposal',
    description: 'Получить смету расхода по хешу.',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getExpenseProposal(
    @Args('proposal_hash', { type: () => String }) proposalHash: string
  ): Promise<ExpenseProposalOutputDTO | null> {
    const entity = await this.expenses.getProposalByHash(proposalHash);
    if (!entity) return null;
    const aggregates = await this.expenses.buildProposalDocumentAggregates(entity);
    return ExpenseProposalOutputDTO.fromDomain(entity, aggregates);
  }

  @Query(() => paginatedExpenseProposalsResult, {
    name: 'expenseProposalsByCooperative',
    description: 'Список смет расходов кооператива (paginated).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async listByCooperative(
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('options', { type: () => PaginationInputDTO, nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<ExpenseProposalOutputDTO>> {
    const result = await this.expenses.listProposalsByCooperativePaginated(coopname, options);
    return { ...result, items: await this.mapItemsWithDocuments(result.items) };
  }

  @Query(() => paginatedExpenseProposalsResult, {
    name: 'expenseProposalsByMember',
    description: 'Список смет расходов пайщика (свои/созданные им, paginated).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async listByMember(
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('username', { type: () => String }) username: string,
    @Args('options', { type: () => PaginationInputDTO, nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<ExpenseProposalOutputDTO>> {
    const result = await this.expenses.listProposalsByMemberPaginated(coopname, username, options);
    return { ...result, items: await this.mapItemsWithDocuments(result.items) };
  }

  private async mapItemsWithDocuments(
    entities: ExpenseProposalDomainEntity[]
  ): Promise<ExpenseProposalOutputDTO[]> {
    return Promise.all(
      entities.map(async (e) => {
        const aggregates = await this.expenses.buildProposalDocumentAggregates(e);
        return ExpenseProposalOutputDTO.fromDomain(e, aggregates);
      })
    );
  }
}
