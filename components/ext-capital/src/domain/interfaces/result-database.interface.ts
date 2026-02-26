import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';
/**
 * Интерфейс данных результата из базы данных
 */
export type IResultDatabaseData = IBaseDatabaseData & {
  result_hash: string;
  project_hash: string;
  coopname: string;
  username: string;
  blockchain_status?: string;
  data?: string;
};
