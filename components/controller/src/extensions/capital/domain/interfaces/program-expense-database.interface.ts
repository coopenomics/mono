import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

export type IProgramExpenseDatabaseData = IBaseDatabaseData & {
  expense_hash: string;
  blockchain_status?: string;
};
