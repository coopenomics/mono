import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';
/**
 * Интерфейс данных долга из базы данных
 */
export type IDebtDatabaseData = IBaseDatabaseData & {
  debt_hash: string;
  blockchain_status?: string;
};
