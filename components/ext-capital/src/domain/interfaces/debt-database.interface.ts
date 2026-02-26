import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';
/**
 * Интерфейс данных долга из базы данных
 */
export type IDebtDatabaseData = IBaseDatabaseData & {
  debt_hash: string;
  blockchain_status?: string;
};
