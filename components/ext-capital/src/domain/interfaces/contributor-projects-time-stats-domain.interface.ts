import type { ProjectTimeStatsDomainInterface } from './project-time-stats-domain.interface';

/**
 * Доменный интерфейс для списка проектов участника со статистикой времени
 */
export interface ContributorProjectsTimeStatsDomainInterface {
  /** Хеш участника */
  contributor_hash: string;

  /** Список проектов с статистикой времени */
  projects: ProjectTimeStatsDomainInterface[];
}
