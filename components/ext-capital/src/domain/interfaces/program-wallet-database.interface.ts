import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Интерфейс данных программного кошелька из базы данных
 */
export type IProgramWalletDatabaseData = IBaseDatabaseData & {
  username: string;
};
