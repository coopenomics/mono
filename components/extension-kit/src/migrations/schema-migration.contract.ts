/**
 * Контекст опциональной фазы миграции данных (PG, вызовы репозиториев и т.д.).
 * `resolve` — Nest `get()` по токену провайдера.
 */
export interface ExtensionSchemaMigrationAfterContext {
  /** Токен Nest DI (строка, symbol или класс вроде DataSource — у конструкторов свои параметры, поэтому `any[]`). */
  resolve: <T = unknown>(typeOrToken: string | symbol | (new (...args: any[]) => any)) => T;
  logInfo: (message: string) => void;
  logWarn: (message: string) => void;
  logError: (message: string, error?: unknown) => void;
}

/** Миграция схемы конфига расширения. */
export interface IExtensionSchemaMigration<TOldConfig = any, TNewConfig = any> {
  /** Уникальное имя расширения. */
  extensionName: string;

  /** Версия миграции — задаёт порядок применения. */
  version: number;

  /**
   * Преобразует старую конфигурацию в новую.
   * @param oldConfig Старая конфигурация из базы данных
   * @param defaultConfig Дефолтная конфигурация новой схемы
   */
  migrate(oldConfig: TOldConfig, defaultConfig: TNewConfig): TNewConfig;

  /**
   * Вызывается до записи новой `schema_version` в БД. При ошибке версия не повышается —
   * миграция повторится при следующем старте.
   */
  afterMigrate?: (ctx: ExtensionSchemaMigrationAfterContext) => Promise<void>;
}
