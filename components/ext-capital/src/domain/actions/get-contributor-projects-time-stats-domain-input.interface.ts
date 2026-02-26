/**
 * Доменный интерфейс для получения списка проектов участника со статистикой времени
 */
export interface GetContributorProjectsTimeStatsDomainInput {
  /** Хеш участника */
  contributor_hash: string;
}
