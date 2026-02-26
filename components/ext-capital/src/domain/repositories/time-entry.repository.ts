import { TimeEntryDomainEntity } from '../entities/time-entry.entity';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { TimeEntriesFilterDomainInterface } from '../interfaces/time-entries-filter-domain.interface';
import type { ContributorProjectBasicTimeStatsDomainInterface } from '../interfaces/time-stats-domain.interface';
import type { TimeEntriesByIssuesDomainInterface } from '../interfaces/time-entries-by-issues-domain.interface';

/**
 * Репозиторий для работы с записями времени
 */
export interface TimeEntryRepository {
  /**
   * Создать запись времени
   */
  create(timeEntry: TimeEntryDomainEntity): Promise<TimeEntryDomainEntity>;

  /**
   * Найти записи времени по участнику и дате
   */
  findByContributorAndDate(contributorHash: string, date: string): Promise<TimeEntryDomainEntity[]>;

  /**
   * Найти незакоммиченные записи времени по участнику
   */
  findUncommittedByContributor(contributorHash: string): Promise<TimeEntryDomainEntity[]>;

  /**
   * Найти незакоммиченные записи времени по проекту и участнику
   */
  findUncommittedByProjectAndContributor(projectHash: string, contributorHash: string): Promise<TimeEntryDomainEntity[]>;

  /**
   * Обновить запись времени
   */
  update(timeEntry: TimeEntryDomainEntity): Promise<TimeEntryDomainEntity>;

  /**
   * Обновить несколько записей
   */
  updateMany(timeEntries: TimeEntryDomainEntity[]): Promise<void>;

  /**
   * Получить суммарное незакоммиченное время по участнику и проекту
   */
  getTotalUncommittedHours(contributorHash: string, projectHash: string): Promise<number>;

  /**
   * Получить базовую статистику времени по участнику и проекту (только committed/uncommitted)
   */
  getContributorProjectStats(
    contributorHash: string,
    projectHash: string
  ): Promise<ContributorProjectBasicTimeStatsDomainInterface>;

  /**
   * Поместить время в коммит (отметить как закоммиченное)
   */
  commitTimeEntries(entries: TimeEntryDomainEntity[], commitHash: string): Promise<void>;

  /**
   * Удалить запись времени
   */
  delete(id: string): Promise<void>;

  /**
   * Найти проекты с записями времени для участника
   */
  findProjectsByContributor(contributorHash: string): Promise<{ project_hash: string; project_name?: string }[]>;

  /**
   * Найти участников с записями времени для проекта
   */
  findContributorsByProject(projectHash: string): Promise<{ contributor_hash: string }[]>;

  /**
   * Найти записи времени по проекту с пагинацией (projectHash опционален)
   */
  findByProjectWithPagination(
    filter: TimeEntriesFilterDomainInterface,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<TimeEntryDomainEntity>>;

  /**
   * Получить агрегированные записи времени по задачам с пагинацией
   */
  getAggregatedTimeEntriesByIssues(
    filter: TimeEntriesFilterDomainInterface,
    limit: number,
    offset: number
  ): Promise<TimeEntriesByIssuesDomainInterface[]>;

  /**
   * Получить общее количество агрегированных записей времени по задачам
   */
  getAggregatedTimeEntriesCount(filter: TimeEntriesFilterDomainInterface): Promise<number>;

  /**
   * Найти записи времени по типу начисления для конкретной задачи
   */
  findByIssueAndType(issueHash: string, entryType: 'hourly' | 'estimate'): Promise<TimeEntryDomainEntity[]>;

  /**
   * Получить сумму estimate времени, уже начисленного для задачи
   */
  getTotalEstimateHoursByIssue(issueHash: string): Promise<{ total: number; estimate_snapshot: number }>;
}

export const TIME_ENTRY_REPOSITORY = Symbol('TIME_ENTRY_REPOSITORY');
