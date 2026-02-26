import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Интерфейс данных возврата из программы из базы данных
 */
export type IProgramWithdrawDatabaseData = IBaseDatabaseData & {
  withdraw_hash: string;
  blockchain_status?: string;
};
