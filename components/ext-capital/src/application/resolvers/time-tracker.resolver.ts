import { Resolver, Query, Args } from '@nestjs/graphql';
import { TimeTrackingService } from '../services/time-tracking.service';
import { TimeStatsInputDTO, FlexibleTimeStatsOutputDTO } from '../dto/time_tracker/flexible-time-stats.dto';
import { TimeEntryOutputDTO } from '../dto/time_tracker/time-entries.dto';
import { TimeEntriesByIssuesOutputDTO } from '../dto/time_tracker/time-entries-by-issues.dto';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { createPaginationResult, PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import { TimeEntriesFilterInputDTO } from '../dto/time_tracker';

// Пагинированные результаты
const paginatedTimeEntriesResult = createPaginationResult(TimeEntryOutputDTO, 'PaginatedCapitalTimeEntries');
const paginatedTimeEntriesByIssuesResult = createPaginationResult(
  TimeEntriesByIssuesOutputDTO,
  'PaginatedCapitalTimeEntriesByIssues'
);

/**
 * GraphQL резолвер для действий учёта времени CAPITAL контракта
 */
@Resolver()
export class TimeTrackerResolver {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  /**
   * Гибкий запрос статистики времени с пагинацией
   */
  @Query(() => FlexibleTimeStatsOutputDTO, {
    name: 'capitalTimeStats',
    description: 'Гибкий запрос статистики времени участников по проектам с пагинацией',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getCapitalTimeStats(
    @Args('data', { nullable: true }) data?: TimeStatsInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<FlexibleTimeStatsOutputDTO> {
    return await this.timeTrackingService.getFlexibleTimeStats(data || {}, options);
  }

  /**
   * Получение пагинированного списка записей времени по проекту
   */
  @Query(() => paginatedTimeEntriesResult, {
    name: 'capitalTimeEntries',
    description: 'Получение пагинированного списка записей времени',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getCapitalTimeEntries(
    @Args('filter', { nullable: true }) filter?: TimeEntriesFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<TimeEntryOutputDTO>> {
    return await this.timeTrackingService.getTimeEntriesByProject(filter || {}, options);
  }

  /**
   * Получение пагинированного списка агрегированных записей времени по задачам
   */
  @Query(() => paginatedTimeEntriesByIssuesResult, {
    name: 'capitalTimeEntriesByIssues',
    description:
      'Получение пагинированного списка агрегированных записей времени по задачам с информацией о задачах и участниках',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getCapitalTimeEntriesByIssues(
    @Args('filter', { nullable: true }) filter?: TimeEntriesFilterInputDTO,
    @Args('options', { nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<TimeEntriesByIssuesOutputDTO>> {
    return await this.timeTrackingService.getTimeEntriesByIssues(filter || {}, options);
  }
}
