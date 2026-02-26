import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';
/**
 * Интерфейс данных инвестиции из базы данных
 */
export type IInvestDatabaseData = IBaseDatabaseData & {
  invest_hash: string;
  blockchain_status?: string;
};
