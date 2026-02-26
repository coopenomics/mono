/**
 * Доменный интерфейс входных данных для гибкого запроса статистики времени
 */
export interface GetFlexibleTimeStatsDomainInput {
  /** Хеш участника (опционально) */
  contributor_hash?: string;

  /** Хеш проекта (опционально) */
  project_hash?: string;

  /** Название кооператива (опционально) */
  coopname?: string;

  /** Имя пользователя (опционально) */
  username?: string;
}
