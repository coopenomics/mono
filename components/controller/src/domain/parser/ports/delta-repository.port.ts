import type { DeltaDomainInterface } from '../interfaces/delta-domain.interface';
import type {
  DeltaFilterDomainInterface,
  PaginatedResultDomainInterface,
} from '../interfaces/parser-config-domain.interface';
import type { TableStateDomainInterface } from '../interfaces/table-state-domain.interface';

/**
 * Порт для репозитория дельт блокчейна
 */
export interface DeltaRepositoryPort {
  /**
   * Сохранение дельты
   */
  save(delta: Omit<DeltaDomainInterface, 'id' | 'created_at'>): Promise<DeltaDomainInterface>;

  /**
   * Получение дельт с фильтрацией и пагинацией
   */
  findMany(
    filter: DeltaFilterDomainInterface,
    page: number,
    limit: number
  ): Promise<PaginatedResultDomainInterface<DeltaDomainInterface>>;

  /**
   * Получение дельты по ID
   */
  findById(id: string): Promise<DeltaDomainInterface | null>;

  /**
   * Удаление дельт после указанного блока
   */
  deleteAfterBlock(blockNum: number): Promise<void>;

  /**
   * Получение общего количества дельт
   */
  count(): Promise<number>;

  /**
   * Получение последней дельты по номеру блока
   */
  findLastByBlock(): Promise<DeltaDomainInterface | null>;

  /**
   * Получение текущих состояний таблиц с фильтрами
   * Возвращает только последние записи с present: true для каждой группы (code, scope, table, primary_key)
   */
  findCurrentTableStates(filters?: { code?: string; scope?: string; table?: string }): Promise<TableStateDomainInterface[]>;

  /**
   * Получение текущих состояний таблиц с фильтрами и пагинацией
   * Возвращает только последние записи с present: true для каждой группы (code, scope, table, primary_key)
   */
  findCurrentTableStatesPaginated(
    filters: { code?: string; scope?: string; table?: string },
    page: number,
    limit: number
  ): Promise<PaginatedResultDomainInterface<TableStateDomainInterface>>;

  /**
   * Поиск дельт с флагом repeat = true
   */
  /**
   * Последнее состояние каждой строки таблицы, включая стёртые из цепи: дельта стирания
   * несёт прежнее содержимое строки, и `present=false` означает, что в цепи её больше нет.
   * `where` сравнивает поле значения как текст, без учёта регистра.
   */
  findLatestRows(
    filters: { code: string; scope: string; table: string },
    where?: Record<string, string>
  ): Promise<{ primary_key: string; value: any; present: boolean; block_num: number }[]>;

  findRepeatableDeltas(): Promise<DeltaDomainInterface[]>;

  /**
   * Сброс флага repeat для указанной дельты
   */
  resetRepeatFlag(id: string): Promise<void>;
}

// Экспорт символа для внедрения зависимостей
export const DELTA_REPOSITORY_PORT = Symbol('DeltaRepositoryPort');
