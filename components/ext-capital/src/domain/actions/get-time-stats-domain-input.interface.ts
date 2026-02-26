/**
 * Доменный интерфейс для получения статистики времени участника по проекту
 */
export interface GetTimeStatsDomainInput {
  /** Хеш участника */
  contributor_hash: string;

  /** Хеш проекта */
  project_hash: string;
}
