import type { ProjectTimeStatsDomainInterface } from './project-time-stats-domain.interface';

/**
 * Доменный интерфейс для гибкого запроса статистики времени
 * Возвращает массив результатов с пагинацией
 */
export interface FlexibleTimeStatsResultDomainInterface {
  /** Список результатов статистики времени */
  items: ProjectTimeStatsDomainInterface[];

  /** Общее количество результатов */
  totalCount: number;

  /** Текущая страница */
  currentPage: number;

  /** Общее количество страниц */
  totalPages: number;
}
