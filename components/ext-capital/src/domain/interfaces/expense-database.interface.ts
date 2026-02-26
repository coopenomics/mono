import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';
/**
 * Интерфейс данных расхода из базы данных
 */
export type IExpenseDatabaseData = IBaseDatabaseData & {
  expense_hash: string;
  blockchain_status?: string;
};
