import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Интерфейс данных проектного имущественного взноса из базы данных
 */
export type IProjectPropertyDatabaseData = IBaseDatabaseData & {
  property_hash: string;
  blockchain_status?: string;
};
