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
   * Найти закоммиченные time-entries по commit_hash. Используется при decline,
   * чтобы понять какие задачи затронуты до отката.
   */
  findCommittedByCommitHash(commitHash: string): Promise<TimeEntryDomainEntity[]>;

  /**
   * Откатить закоммиченные time-entries по commit_hash обратно в uncommitted
   * (is_committed=false, commit_hash=NULL). Используется при decline коммита, чтобы
   * часы вернулись в доступный пул. Идемпотентно.
   *
   * @returns количество затронутых записей
   */
  revertCommittedEntriesByCommitHash(commitHash: string): Promise<number>;

  /**
   * Удалить запись времени
   */
  delete(id: string): Promise<void>;

  /**
   * Удалить все незакоммиченные записи времени по задаче (почасовые и estimate)
   */
  deleteUncommittedByIssueHash(issueHash: string): Promise<void>;

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

  /**
   * Есть ли по задаче время, уже зафиксированное в коммитах (билеты списаны в экономику компонента)
   */
  hasCommittedTimeByIssueHash(issueHash: string): Promise<boolean>;

  /**
   * Обновить project_hash у всех записей времени по задаче (перенос между компонентами одного проекта)
   */
  updateProjectHashByIssueHash(issueHash: string, projectHash: string): Promise<void>;

  /**
   * Агрегат фактически накопленного времени по задачам (батч).
   * Ключ в Map — issue_hash в lowercase. Возвращает только те задачи,
   * по которым есть хотя бы одна запись; отсутствующие задачи нужно считать нулевым фактом.
   */
  getFactByIssues(issueHashes: string[]): Promise<Map<string, IssueFactAggregate>>;
}

/**
 * Агрегат факта по одной задаче. Совпадает по смыслу с полями в CapitalIssue DTO.
 */
export interface IssueFactAggregate {
  fact: number;
  fact_committed: number;
  fact_uncommitted: number;
  fact_by_contributor: Array<{ contributor_hash: string; hours: number }>;
}

export const TIME_ENTRY_REPOSITORY = Symbol('TIME_ENTRY_REPOSITORY');
