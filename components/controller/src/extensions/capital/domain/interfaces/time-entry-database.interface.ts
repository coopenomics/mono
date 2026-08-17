import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';

/**
 * Тип / источник записи времени.
 * hourly | estimate — старые авто-записи (новые не создаём).
 * manual | timer — явный учёт (ручной ввод / таймер на одну задачу).
 */
export type TimeEntryType = 'hourly' | 'estimate' | 'manual' | 'timer';

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
  entry_type?: TimeEntryType;
  /** Снимок плана у старых записей типа estimate */
  estimate_snapshot?: number;
};
