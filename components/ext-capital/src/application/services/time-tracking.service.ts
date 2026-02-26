import { Injectable } from '@nestjs/common';
import { TimeTrackingInteractor } from '../use-cases/time-tracking.interactor';
import { TimeEntryDomainEntity } from '../../domain/entities/time-entry.entity';
import type { ContributorProjectsTimeStatsInputDTO } from '../dto/time_tracker/project-time-stats.dto';
import type { ContributorProjectsTimeStatsOutputDTO } from '../dto/time_tracker/project-time-stats.dto';
import type { TimeStatsInputDTO } from '../dto/time_tracker/flexible-time-stats.dto';
import type { FlexibleTimeStatsOutputDTO } from '../dto/time_tracker/flexible-time-stats.dto';
import type { TimeEntryOutputDTO } from '../dto/time_tracker/time-entries.dto';
import type { TimeEntriesByIssuesOutputDTO } from '../dto/time_tracker/time-entries-by-issues.dto';
import type { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import type { TimeEntriesFilterInputDTO } from '../dto/time_tracker';
import type { PaginationInputDomainInterface } from '~/domain/common/interfaces/pagination.interface';

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
    // Конвертируем PaginationInputDTO в PaginationInputDomainInterface
    const domainOptions: PaginationInputDomainInterface | undefined = options
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
    // Конвертируем PaginationInputDTO в PaginationInputDomainInterface
    const domainOptions: PaginationInputDomainInterface | undefined = options
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
    // Конвертируем PaginationInputDTO в PaginationInputDomainInterface
    const domainOptions: PaginationInputDomainInterface | undefined = options
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
