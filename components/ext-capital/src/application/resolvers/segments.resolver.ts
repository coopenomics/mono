import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { SegmentsService } from '../services/segments.service';
import { SegmentOutputDTO } from '../dto/segments/segment.dto';
import { SegmentFilterInputDTO } from '../dto/segments/segment-filter.input';
import { RefreshSegmentInputDTO } from '../dto/segments/refresh-segment-input.dto';
import { createPaginationResult, PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';

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
    @Args('filter', { nullable: true }) filter?: SegmentFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<SegmentOutputDTO>> {
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
