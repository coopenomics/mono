import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Интерфейс данных приложения из базы данных
 */
export type IAppendixDatabaseData = IBaseDatabaseData & {
  appendix_hash: string;
  blockchain_status?: string;
  contribution?: string;
};
