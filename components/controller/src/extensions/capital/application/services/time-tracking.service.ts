import { Injectable } from '@nestjs/common';
import { TimeTrackingInteractor } from '../use-cases/time-tracking.interactor';
import { TimeEntryDomainEntity } from '../../domain/entities/time-entry.entity';
import { TimerSessionDomainEntity } from '../../domain/entities/timer-session.entity';
import type { ContributorProjectsTimeStatsInputDTO } from '../dto/time_tracker/project-time-stats.dto';
import type { ContributorProjectsTimeStatsOutputDTO } from '../dto/time_tracker/project-time-stats.dto';
import type { TimeStatsInputDTO } from '../dto/time_tracker/flexible-time-stats.dto';
import type { FlexibleTimeStatsOutputDTO } from '../dto/time_tracker/flexible-time-stats.dto';
import type { TimeEntryOutputDTO } from '../dto/time_tracker/time-entries.dto';
import type { TimeEntriesByIssuesOutputDTO } from '../dto/time_tracker/time-entries-by-issues.dto';
import type { CapitalTimerSessionOutputDTO } from '../dto/time_tracker/worklog.dto';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import type { TimeEntriesFilterInputDTO } from '../dto/time_tracker';

/**
 * Сервис для учёта времени в CAPITAL контракте
 * Обрабатывает запросы от резолверов, конвертирует DTO в доменные объекты и обратно
 */
@Injectable()
export class TimeTrackingService {
  constructor(private readonly timeTrackingInteractor: TimeTrackingInteractor) {}

  /**
   * Зафиксировать время в коммите (отметить записи как закоммиченные)
   */
  async commitTime(contributorHash: string, projectHash: string, hours: number, commitHash: string): Promise<void> {
    await this.timeTrackingInteractor.commitTime(contributorHash, projectHash, hours, commitHash);
  }

  /**
   * Получить доступное время для коммита
   */
  async getAvailableCommitHours(contributorHash: string, projectHash: string): Promise<number> {
    return await this.timeTrackingInteractor.getAvailableCommitHours(contributorHash, projectHash);
  }

  /**
   * Лечебный пересчёт estimate-билетов по всем DONE-задачам проекта, где участник сейчас creator.
   * Идемпотентно. Используется как «ленивый ремонт» перед расчётом доступного времени.
   */
  async recalcDoneEstimatesForContributorProject(contributorHash: string, projectHash: string): Promise<void> {
    await this.timeTrackingInteractor.recalcDoneEstimatesForContributorProject(contributorHash, projectHash);
  }

  /**
   * Откатить time-entries отклонённого коммита обратно в uncommitted и нормализовать
   * раскладку estimate-долей для затронутых задач.
   */
  async revertEntriesForDeclinedCommit(commitHash: string): Promise<void> {
    await this.timeTrackingInteractor.revertEntriesForDeclinedCommit(commitHash);
  }

  /**
   * Задачи, чьи часы вошли в коммит (снимок для commit.data / UI).
   */
  async getCommittedIssueSummaries(
    commitHash: string
  ): Promise<Array<{ issue_hash: string; title: string }>> {
    return this.timeTrackingInteractor.getCommittedIssueSummaries(commitHash);
  }

  /**
   * Получить статистику времени для участника по проекту (DTO версия)
   */
  async getTimeStats(contributorHash: string, projectHash: string) {
    const domainResult = await this.timeTrackingInteractor.getTimeStats({
      contributor_hash: contributorHash,
      project_hash: projectHash,
    });

    return domainResult;
  }

  /**
   * Получить список проектов с статистикой времени для участника
   */
  async getContributorProjectsTimeStats(
    data: ContributorProjectsTimeStatsInputDTO
  ): Promise<ContributorProjectsTimeStatsOutputDTO> {
    const domainResult = await this.timeTrackingInteractor.getContributorProjectsTimeStats({
      contributor_hash: data.contributor_hash,
    });

    return {
      contributor_hash: domainResult.contributor_hash,
      projects: domainResult.projects.map((project) => ({
        project_hash: project.project_hash,
        project_name: project.project_name,
        contributor_hash: project.contributor_hash,
        total_committed_hours: project.total_committed_hours,
        total_uncommitted_hours: project.total_uncommitted_hours,
        available_hours: project.available_hours,
        pending_hours: project.pending_hours,
      })),
    };
  }

  /**
   * Получить пагинированные записи времени по проекту
   */
  async getTimeEntriesByProject(
    filter: TimeEntriesFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<TimeEntryOutputDTO>> {
    // Конвертируем PaginationInputDTO в PaginationInputDTO
    const domainOptions: PaginationInputDTO | undefined = options
      ? {
          page: options.page,
          limit: options.limit,
          sortBy: options.sortBy,
          sortOrder: options.sortOrder,
        }
      : undefined;

    const domainResult = await this.timeTrackingInteractor.getTimeEntries(
      {
        project_hash: filter.project_hash,
        contributor_hash: filter.contributor_hash,
        issue_hash: filter.issue_hash,
        is_committed: filter.is_committed,
        coopname: filter.coopname,
        username: filter.username,
      },
      domainOptions
    );

    return {
      items: domainResult.items.map(this.mapTimeEntryToDTO),
      totalCount: domainResult.totalCount,
      currentPage: domainResult.currentPage,
      totalPages: domainResult.totalPages,
    };
  }

  /**
   * Гибкий запрос статистики времени с пагинацией
   */
  async getFlexibleTimeStats(data: TimeStatsInputDTO, options?: PaginationInputDTO): Promise<FlexibleTimeStatsOutputDTO> {
    // Конвертируем PaginationInputDTO в PaginationInputDTO
    const domainOptions: PaginationInputDTO | undefined = options
      ? {
          page: options.page,
          limit: options.limit,
          sortBy: options.sortBy,
          sortOrder: options.sortOrder,
        }
      : undefined;

    const domainResult = await this.timeTrackingInteractor.getFlexibleTimeStats(data, domainOptions);

    return {
      items: domainResult.items,
      totalCount: domainResult.totalCount,
      currentPage: domainResult.currentPage,
      totalPages: domainResult.totalPages,
    };
  }

  /**
   * Получить агрегированные записи времени по задачам с пагинацией
   */
  async getTimeEntriesByIssues(
    filter: TimeEntriesFilterInputDTO,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<TimeEntriesByIssuesOutputDTO>> {
    // Конвертируем PaginationInputDTO в PaginationInputDTO
    const domainOptions: PaginationInputDTO | undefined = options
      ? {
          page: options.page,
          limit: options.limit,
          sortBy: options.sortBy,
          sortOrder: options.sortOrder,
        }
      : undefined;

    const domainResult = await this.timeTrackingInteractor.getTimeEntriesByIssues(
      {
        project_hash: filter.project_hash,
        contributor_hash: filter.contributor_hash,
        is_committed: filter.is_committed,
        coopname: filter.coopname,
        username: filter.username,
      },
      domainOptions
    );

    return {
      items: domainResult.items,
      totalCount: domainResult.totalCount,
      currentPage: domainResult.currentPage,
      totalPages: domainResult.totalPages,
    };
  }

  /**
   * Ручной worklog — факт на исполнителя задачи.
   */
  async addWorklog(data: {
    username: string;
    coopname: string;
    issue_hash: string;
    hours: number;
    date?: string;
  }): Promise<TimeEntryOutputDTO> {
    const entity = await this.timeTrackingInteractor.addWorklog(data);
    return this.mapTimeEntryToDTO(entity);
  }

  async startTimer(data: {
    username: string;
    coopname: string;
    issue_hash: string;
  }): Promise<CapitalTimerSessionOutputDTO> {
    const session = await this.timeTrackingInteractor.startTimer(data);
    return this.mapTimerSessionToDTO(session);
  }

  async stopTimer(data: { username: string; coopname: string }): Promise<TimeEntryOutputDTO | null> {
    const entity = await this.timeTrackingInteractor.stopTimer(data);
    return entity ? this.mapTimeEntryToDTO(entity) : null;
  }

  async pauseTimer(data: { username: string; coopname: string }): Promise<CapitalTimerSessionOutputDTO> {
    const session = await this.timeTrackingInteractor.pauseTimer(data);
    return this.mapTimerSessionToDTO(session);
  }

  async resumeTimer(data: { username: string; coopname: string }): Promise<CapitalTimerSessionOutputDTO> {
    const session = await this.timeTrackingInteractor.resumeTimer(data);
    return this.mapTimerSessionToDTO(session);
  }

  async getOpenTimer(data: {
    username: string;
    coopname: string;
  }): Promise<CapitalTimerSessionOutputDTO | null> {
    const session = await this.timeTrackingInteractor.getOpenTimer(data);
    if (!session) return null;
    return this.mapTimerSessionToDTO(session);
  }

  private async mapTimerSessionToDTO(session: TimerSessionDomainEntity): Promise<CapitalTimerSessionOutputDTO> {
    const issueTitle = await this.timeTrackingInteractor.resolveIssueTitle(session.issue_hash);
    return {
      _id: session._id,
      contributor_hash: session.contributor_hash,
      issue_hash: session.issue_hash,
      project_hash: session.project_hash,
      coopname: session.coopname,
      started_at: session.started_at,
      stopped_at: session.stopped_at ?? null,
      paused_at: session.paused_at ?? null,
      total_paused_ms: Number(session.total_paused_ms || 0),
      is_paused: session.isPaused,
      elapsed_seconds: Math.floor(session.getElapsedMs() / 1000),
      issue_title: issueTitle,
    };
  }

  /**
   * Преобразование доменной сущности TimeEntry в DTO
   */
  private mapTimeEntryToDTO(entity: TimeEntryDomainEntity): TimeEntryOutputDTO {
    return {
      _id: entity._id,
      contributor_hash: entity.contributor_hash,
      issue_hash: entity.issue_hash,
      project_hash: entity.project_hash,
      coopname: entity.coopname,
      date: entity.date,
      hours: entity.hours,
      commit_hash: entity.commit_hash,
      is_committed: entity.is_committed,
      entry_type: entity.entry_type,
      estimate_snapshot: entity.estimate_snapshot,
      _created_at: entity._created_at.toISOString(),
      _updated_at: entity._updated_at.toISOString(),
    };
  }
}
