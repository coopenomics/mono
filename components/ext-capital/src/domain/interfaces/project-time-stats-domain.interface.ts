/**
 * Доменный интерфейс для статистики времени по проекту участника
 */
export interface ProjectTimeStatsDomainInterface {
  /** Хеш проекта */
  project_hash: string;

  /** Название проекта */
  project_name: string;

  /** Хеш участника */
  contributor_hash: string;

  /** Сумма закоммиченного времени (часы) */
  total_committed_hours: number;

  /** Сумма незакоммиченного времени (часы) */
  total_uncommitted_hours: number;

  /** Доступное время для коммита (по завершённым задачам) */
  available_hours: number;

  /** Время в ожидании (по незавершённым задачам) */
  pending_hours: number;
}
