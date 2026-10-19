import type { ICooperativeCharterDatabaseData } from '../interfaces/cooperative-charter-database.interface';

/**
 * Реестр уставов кооперативов. Чистая БД-сущность (метаданные + ключ в MinIO),
 * блокчейна за ней нет — поэтому sync-репозиторий не наследуется.
 */
export interface CooperativeCharterRepository {
  create(data: ICooperativeCharterDatabaseData): Promise<ICooperativeCharterDatabaseData>;
  findById(id: number): Promise<ICooperativeCharterDatabaseData | null>;
  /** Последний загруженный устав кооператива — его и показываем совету. */
  findLatestByUsername(coopname: string, username: string): Promise<ICooperativeCharterDatabaseData | null>;
  /** Последние уставы сразу для списка кооперативов — реестр рисуется одним запросом. */
  findLatestForUsernames(coopname: string, usernames: string[]): Promise<ICooperativeCharterDatabaseData[]>;
  delete(id: number): Promise<void>;
}

export const COOPERATIVE_CHARTER_REPOSITORY = Symbol('CooperativeCharterRepository');
