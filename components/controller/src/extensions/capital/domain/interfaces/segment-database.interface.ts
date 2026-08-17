import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';

/**
 * Интерфейс данных сегмента из базы данных
 */
export interface ISegmentDatabaseData extends IBaseDatabaseData {
  segment_hash?: string; // Хэш сегмента для синхронизации
  is_completed?: boolean; // Завершена ли конвертация сегмента
}
