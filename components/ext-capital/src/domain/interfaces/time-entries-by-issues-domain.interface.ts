import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';

/**
 * Доменный интерфейс для агрегированной статистики времени по задачам
 */
export interface TimeEntriesByIssuesDomainInterface {
  /** Хеш задачи */
  issue_hash: string;

  /** Название задачи */
  issue_title: string;

  /** Хеш проекта */
  project_hash: string;

  /** Название проекта */
  project_name: string;

  /** Хеш участника */
  contributor_hash: string;

  /** Имя участника */
  contributor_name: string;

  /** Название кооператива */
  coopname: string;

  /** Общее количество часов по задаче */
  total_hours: number;

  /** Количество закоммиченных часов */
  committed_hours: number;

  /** Количество незакоммиченных часов */
  uncommitted_hours: number;

  /** Доступное время для коммита (по завершённым задачам) */
  available_hours: number;

  /** Время в ожидании (по незавершённым задачам) */
  pending_hours: number;
}

/**
 * Доменный интерфейс для результата пагинированных агрегированных записей времени по задачам
 */
export type TimeEntriesByIssuesResultDomainInterface = PaginationResultDomainInterface<TimeEntriesByIssuesDomainInterface>;
