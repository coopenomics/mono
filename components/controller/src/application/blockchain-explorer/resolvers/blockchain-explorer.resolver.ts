import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, createPaginationResult, PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { DeltaService } from '../services/delta.service';
import { ActionService } from '../services/action.service';
import { CurrentTableStatesService } from '../services/current-table-states.service';
import { DeltaDTO } from '../dto/delta.dto';
import { CurrentTableStateDTO } from '../dto/current-table-state.dto';
import { DeltaFiltersInputDTO } from '../dto/delta-filters-input.dto';
import { ActionFiltersInputDTO } from '../dto/action-filters-input.dto';
import { CurrentTableStatesFiltersInputDTO } from '../dto/current-table-states-filters-input.dto';
import { BlockchainActionDTO } from '~/application/common/dto/blockchain-action.dto';
const paginatedDeltasResult = createPaginationResult(DeltaDTO, 'PaginatedDeltas');
const paginatedActionsResult = createPaginationResult(BlockchainActionDTO, 'PaginatedActions');
const paginatedCurrentTableStatesResult = createPaginationResult(CurrentTableStateDTO, 'PaginatedCurrentTableStates');

/**
 * GraphQL резолвер для блокчейн обозревателя
 * Обеспечивает API для просмотра дельт и действий блокчейна с фильтрацией и пагинацией
 */
@Resolver()
export class BlockchainExplorerResolver {
  constructor(
    private readonly deltaService: DeltaService,
    private readonly actionService: ActionService,
    private readonly currentTableStatesService: CurrentTableStatesService
  ) {}

  /**
   * Query: Получить список дельт с фильтрацией и пагинацией
   */
  @Query(() => paginatedDeltasResult, {
    name: 'getDeltas',
    description:
      'Получить список дельт блокчейна с возможностью фильтрации по контракту, таблице, блоку и другим параметрам.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getDeltas(
    @Args('filters', { nullable: true }) filters: DeltaFiltersInputDTO = {},
    @Args('pagination', { nullable: true }) pagination: PaginationInputDTO = { page: 1, limit: 10, sortOrder: 'DESC' }
  ): Promise<PaginationResult<DeltaDTO>> {
    return this.deltaService.getDeltas(filters, pagination);
  }

  /**
   * Query: Получить список действий с фильтрацией и пагинацией
   */
  @Query(() => paginatedActionsResult, {
    name: 'getActions',
    description:
      'Получить список действий блокчейна с возможностью фильтрации по аккаунту, имени действия, блоку и другим параметрам.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getActions(
    @Args('filters', { nullable: true }) filters: ActionFiltersInputDTO = {},
    @Args('pagination', { nullable: true }) pagination: PaginationInputDTO = { page: 1, limit: 10, sortOrder: 'DESC' }
  ): Promise<PaginationResult<BlockchainActionDTO>> {
    return this.actionService.getActions(filters, pagination);
  }

  /**
   * Query: Получить текущие состояния таблиц
   */
  @Query(() => paginatedCurrentTableStatesResult, {
    name: 'getCurrentTableStates',
    description: 'Получить текущие состояния таблиц блокчейна с фильтрацией по контракту, области и таблице.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getCurrentTableStates(
    @Args('filters', { nullable: true }) filters: CurrentTableStatesFiltersInputDTO = {},
    @Args('pagination', { nullable: true }) pagination: PaginationInputDTO = { page: 1, limit: 10, sortOrder: 'DESC' }
  ): Promise<PaginationResult<CurrentTableStateDTO>> {
    return this.currentTableStatesService.getCurrentTableStates(filters, pagination);
  }
}
