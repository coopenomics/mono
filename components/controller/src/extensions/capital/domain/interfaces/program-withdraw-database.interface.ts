import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';

/**
 * Интерфейс данных возврата из программы из базы данных
 */
export type IProgramWithdrawDatabaseData = IBaseDatabaseData & {
  withdraw_hash: string;
  blockchain_status?: string;
};
