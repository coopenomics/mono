/**
 * Интерфейс данных индекса файлов GitHub
 */
export interface IGitHubFileIndexData {
  id?: string;
  coopname: string;
  entity_type: 'project' | 'issue' | 'story' | 'result';
  entity_hash: string;
  file_path: string;
  github_sha?: string;
  created_at?: Date;
  last_synced_at?: Date;
}

/**
 * Репозиторий для работы с индексом файлов GitHub
 * Определяет контракт для работы с хранилищем маппинга hash → filename
 */
export interface GitHubFileIndexRepository {
  /**
   * Найти индекс по типу и хэшу сущности
   * @param entityType - тип сущности ('project', 'issue', 'story', 'result')
   * @param entityHash - хэш сущности
   * @param coopname - имя кооператива
   * @returns индекс или null, если не найден
   */
  findByHash(entityType: string, entityHash: string, coopname: string): Promise<IGitHubFileIndexData | null>;

  /**
   * Найти индекс по пути к файлу
   * @param filePath - путь к файлу в репозитории
   * @param coopname - имя кооператива
   * @returns индекс или null, если не найден
   */
  findByPath(filePath: string, coopname: string): Promise<IGitHubFileIndexData | null>;

  /**
   * Создать или обновить индекс
   * @param data - данные индекса
   * @returns созданный или обновлённый индекс
   */
  upsert(data: IGitHubFileIndexData): Promise<IGitHubFileIndexData>;

  /**
   * Удалить индекс по типу и хэшу
   * @param entityType - тип сущности
   * @param entityHash - хэш сущности
   * @param coopname - имя кооператива
   */
  deleteByHash(entityType: string, entityHash: string, coopname: string): Promise<void>;

  /**
   * Получить все индексы для кооператива
   * @param coopname - имя кооператива
   * @returns массив индексов
   */
  getAllIndexes(coopname: string): Promise<IGitHubFileIndexData[]>;

  /**
   * Получить последний SHA коммита для кооператива
   * @param coopname - имя кооператива
   * @returns SHA последнего коммита или null
   */
  getLastSyncedSha(coopname: string): Promise<string | null>;
}

/**
 * Токен для инъекции зависимости репозитория индекса файлов GitHub
 */
export const GITHUB_FILE_INDEX_REPOSITORY = Symbol('GitHubFileIndexRepository');
