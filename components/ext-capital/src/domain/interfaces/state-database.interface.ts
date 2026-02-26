import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';
/**
 * Интерфейс данных состояния из базы данных
 */
export type IStateDatabaseData = IBaseDatabaseData & {
  coopname: string;
};
