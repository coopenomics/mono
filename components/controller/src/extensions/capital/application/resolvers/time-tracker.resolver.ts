import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { TimeTrackingService } from '../services/time-tracking.service';
import { TimeStatsInputDTO, FlexibleTimeStatsOutputDTO } from '../dto/time_tracker/flexible-time-stats.dto';
import { TimeEntryOutputDTO } from '../dto/time_tracker/time-entries.dto';
import { TimeEntriesByIssuesOutputDTO } from '../dto/time_tracker/time-entries-by-issues.dto';
import {
  CapitalAddWorklogInputDTO,
  CapitalStartTimerInputDTO,
  CapitalStopTimerInputDTO,
  CapitalPauseTimerInputDTO,
  CapitalResumeTimerInputDTO,
  CapitalGetOpenTimerInputDTO,
  CapitalTimerSessionOutputDTO,
} from '../dto/time_tracker/worklog.dto';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { createPaginationResult, PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import { TimeEntriesFilterInputDTO } from '../dto/time_tracker';

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

  @Query(() => CapitalTimerSessionOutputDTO, {
    name: 'capitalGetOpenTimer',
    description: 'Открытая сессия таймера участника (если есть)',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getOpenTimer(
    @Args('data') data: CapitalGetOpenTimerInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<CapitalTimerSessionOutputDTO | null> {
    this.assertSelfOrElevated(data.username, currentUser);
    return this.timeTrackingService.getOpenTimer(data);
  }

  @Mutation(() => TimeEntryOutputDTO, {
    name: 'capitalAddWorklog',
    description: 'Ручная запись фактического времени по задаче (на себя как исполнителя)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async addWorklog(
    @Args('data') data: CapitalAddWorklogInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<TimeEntryOutputDTO> {
    this.assertSelfOrElevated(data.username, currentUser);
    return this.timeTrackingService.addWorklog(data);
  }

  @Mutation(() => CapitalTimerSessionOutputDTO, {
    name: 'capitalStartTimer',
    description: 'Старт таймера на задаче (не больше одной открытой сессии на участника)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async startTimer(
    @Args('data') data: CapitalStartTimerInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<CapitalTimerSessionOutputDTO> {
    this.assertSelfOrElevated(data.username, currentUser);
    return this.timeTrackingService.startTimer(data);
  }

  @Mutation(() => TimeEntryOutputDTO, {
    name: 'capitalStopTimer',
    description: 'Остановка открытого таймера — создаёт запись факта по задаче таймера',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async stopTimer(
    @Args('data') data: CapitalStopTimerInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<TimeEntryOutputDTO | null> {
    this.assertSelfOrElevated(data.username, currentUser);
    return this.timeTrackingService.stopTimer(data);
  }

  @Mutation(() => CapitalTimerSessionOutputDTO, {
    name: 'capitalPauseTimer',
    description: 'Пауза таймера — задача остаётся привязанной, время не тикает',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async pauseTimer(
    @Args('data') data: CapitalPauseTimerInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<CapitalTimerSessionOutputDTO> {
    this.assertSelfOrElevated(data.username, currentUser);
    return this.timeTrackingService.pauseTimer(data);
  }

  @Mutation(() => CapitalTimerSessionOutputDTO, {
    name: 'capitalResumeTimer',
    description: 'Продолжить таймер после паузы на той же задаче',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async resumeTimer(
    @Args('data') data: CapitalResumeTimerInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<CapitalTimerSessionOutputDTO> {
    this.assertSelfOrElevated(data.username, currentUser);
    return this.timeTrackingService.resumeTimer(data);
  }

  private assertSelfOrElevated(username: string, currentUser: MonoAccountDomainInterface): void {
    if (username === currentUser.username) return;
    const role = (currentUser as { role?: string }).role;
    if (role === 'chairman' || role === 'member') return;
    throw new Error('Можно учитывать время только от своего имени');
  }
}
