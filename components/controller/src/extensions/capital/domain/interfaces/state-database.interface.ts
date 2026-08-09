import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';
/**
 * Интерфейс данных состояния из базы данных
 */
export type IStateDatabaseData = IBaseDatabaseData & {
  coopname: string;
};
