import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';

/**
 * Интерфейс данных приложения из базы данных
 */
export type IAppendixDatabaseData = IBaseDatabaseData & {
  appendix_hash: string;
  blockchain_status?: string;
  contribution?: string;
};
