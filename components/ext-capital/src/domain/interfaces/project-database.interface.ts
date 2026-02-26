import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';
/**
 * Интерфейс данных проекта из базы данных
 */
export type IProjectDomainInterfaceDatabaseData = IBaseDatabaseData & {
  project_hash: string;
  blockchain_status?: string;
  prefix: string; // Префикс проекта из первых 3 символов project_hash в верхнем регистре
  issue_counter: number; // Счетчик для генерации последовательных ID задач
  voting_deadline: Date | null; // Денормализованное поле для быстрого поиска проектов с голосованиями (null = нет голосования)
};
