/**
 * Доменный интерфейс для статистики времени участника по проекту
 */
export interface TimeStatsDomainInterface {
  /** Хеш участника */
  contributor_hash: string;

  /** Хеш проекта */
  project_hash: string;

  /** Сумма закоммиченного времени (часы) */
  total_committed_hours: number;

  /** Сумма незакоммиченного времени (часы) */
  total_uncommitted_hours: number;

  /** Доступное время для коммита (по завершённым задачам) */
  available_hours: number;

  /** Время в ожидании (по незавершённым задачам) */
  pending_hours: number;
}

/**
 * Доменный интерфейс для базовой статистики времени из репозитория (только committed/uncommitted)
 */
export interface ContributorProjectBasicTimeStatsDomainInterface {
  /** Сумма закоммиченного времени (часы) */
  total_committed_hours: number;

  /** Сумма незакоммиченного времени (часы) */
  total_uncommitted_hours: number;
}

/**
 * Доменный интерфейс для полной статистики времени участника по проекту (с available/pending)
 */
export interface ContributorProjectTimeStatsDomainInterface extends ContributorProjectBasicTimeStatsDomainInterface {
  /** Доступное время для коммита (по завершённым задачам) */
  available_hours: number;

  /** Время в ожидании (по незавершённым задачам) */
  pending_hours: number;
}
