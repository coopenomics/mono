import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Интерфейс данных сегмента из базы данных
 */
export interface ISegmentDatabaseData extends IBaseDatabaseData {
  segment_hash?: string; // Хэш сегмента для синхронизации
  is_completed?: boolean; // Завершена ли конвертация сегмента
}
