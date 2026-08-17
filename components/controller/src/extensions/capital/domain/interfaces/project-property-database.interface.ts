import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';

/**
 * Интерфейс данных проектного имущественного взноса из базы данных
 */
export type IProjectPropertyDatabaseData = IBaseDatabaseData & {
  property_hash: string;
  blockchain_status?: string;
};
