import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { SegmentsService } from '../services/segments.service';
import { SegmentOutputDTO } from '../dto/segments/segment.dto';
import { SegmentFilterInputDTO } from '../dto/segments/segment-filter.input';
import { RefreshSegmentInputDTO } from '../dto/segments/refresh-segment-input.dto';
import { createPaginationResult, PaginationInputDTO, PaginationResult, GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { ForbiddenException, UseGuards } from '@nestjs/common';
// Пагинированные результаты
const paginatedSegmentsResult = createPaginationResult(SegmentOutputDTO, 'PaginatedCapitalSegments');

/**
 * GraphQL резолвер для запросов сегментов CAPITAL контракта
 */
@Resolver()
export class SegmentsResolver {
  constructor(private readonly segmentsService: SegmentsService) {}

  /**
   * Получение всех сегментов с фильтрацией и пагинацией
   */
  @Query(() => paginatedSegmentsResult, {
    name: 'capitalSegments',
    description: 'Получение списка сегментов кооператива с фильтрацией и пагинацией',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getSegments(
    @CurrentUser() currentUser: IMonoAccount,
    @Args('filter', { nullable: true }) filter?: SegmentFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<SegmentOutputDTO>> {
    // Сводный список долей — по всему кооперативу — читает только совет.
    // На клиенте вкладка с ним и так закрыта по роли, но сам запрос ролью не
    // ограничивался: рядовой пайщик получал чужие доли, обратившись напрямую.
    //
    // Запрос ПО КОНКРЕТНОМУ ПРОЕКТУ не трогаем: на нём стоят все рабочие
    // виджеты (голосование, состав участников, подача результата), и они
    // должны работать у любого участника проекта.
    const isBoardMember = currentUser?.role === 'chairman' || currentUser?.role === 'member';
    if (!filter?.project_hash && !isBoardMember) {
      throw new ForbiddenException(
        'Сводный список долей кооператива доступен только совету. Укажите проект в фильтре.'
      );
    }

    return await this.segmentsService.getSegments(filter, options);
  }

  /**
   * Получение одного сегмента по фильтрам
   */
  @Query(() => SegmentOutputDTO, {
    name: 'capitalSegment',
    description: 'Получение одного сегмента кооператива по фильтрам',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard)
  async getSegment(@Args('filter', { nullable: true }) filter?: SegmentFilterInputDTO): Promise<SegmentOutputDTO | null> {
    return await this.segmentsService.getSegment(filter);
  }

  /**
   * Мутация для обновления сегмента в CAPITAL контракте
   */
  @Mutation(() => SegmentOutputDTO, {
    name: 'capitalRefreshSegment',
    description: 'Обновление сегмента в CAPITAL контракте',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async refreshCapitalSegment(
    @Args('data', { type: () => RefreshSegmentInputDTO }) data: RefreshSegmentInputDTO
  ): Promise<SegmentOutputDTO | null> {
    return await this.segmentsService.refreshSegment(data);
  }
}
