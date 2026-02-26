import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';

/**
 * Тип начисления времени
 */
export type TimeEntryType = 'hourly' | 'estimate';

/**
 * Интерфейс данных записи времени из базы данных
 */
export type ITimeEntryDatabaseData = IBaseDatabaseData & {
  contributor_hash: string;
  issue_hash: string;
  project_hash: string;
  coopname: string;
  date: string;
  hours: number;
  commit_hash?: string;
  is_committed: boolean;
  entry_type?: TimeEntryType; // Тип начисления: 'hourly' (почасовое) или 'estimate' (по завершению)
  estimate_snapshot?: number; // Снимок estimate на момент начисления (для отслеживания изменений)
};
