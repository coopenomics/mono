import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';

/**
 * Интерфейс данных программного имущественного взноса из базы данных
 */
export type IProgramPropertyDatabaseData = IBaseDatabaseData & {
  property_hash: string;
  blockchain_status?: string;
};
