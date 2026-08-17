import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';
/**
 * Интерфейс данных инвестиции из базы данных
 */
export type IInvestDatabaseData = IBaseDatabaseData & {
  invest_hash: string;
  blockchain_status?: string;
};
