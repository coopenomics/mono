import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';
/**
 * Интерфейс данных расхода из базы данных
 */
export type IExpenseDatabaseData = IBaseDatabaseData & {
  expense_hash: string;
  blockchain_status?: string;
};
