import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Интерфейс данных программного имущественного взноса из базы данных
 */
export type IProgramPropertyDatabaseData = IBaseDatabaseData & {
  property_hash: string;
  blockchain_status?: string;
};
