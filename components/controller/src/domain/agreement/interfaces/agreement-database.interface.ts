import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';

/**
 * Интерфейс данных соглашения из базы данных
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IAgreementDatabaseData extends IBaseDatabaseData {
  // Дополнительные поля базы данных, если нужны
  // Например, кэшированные вычисляемые поля или индексы
}
