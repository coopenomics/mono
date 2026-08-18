import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';

/**
 * Интерфейс данных программного кошелька из базы данных
 */
export type IProgramWalletDatabaseData = IBaseDatabaseData & {
  username: string;
};
