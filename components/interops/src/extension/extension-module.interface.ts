/**
 * Контракт расширения платформы.
 *
 * Каждое расширение (как встроенное, так и приватное) должно экспортировать
 * объект, реализующий этот интерфейс. Ядро загружает расширения динамически
 * и вызывает register() при подключении.
 *
 * Жизненный цикл:
 *   1. Ядро обнаруживает пакет (node_modules или встроенный)
 *   2. Вызывает getMetadata() для получения информации
 *   3. Вызывает getBackendModule() для получения NestJS-модуля
 *   4. Опционально вызывает getFrontendManifest() для регистрации UI
 */

export interface IExtensionMetadata {
  name: string;
  version: string;
  title: string;
  description: string;
  icon?: string;
  image?: string;
  tags?: string[];
  /** Требует ли лицензию */
  requiresLicense?: boolean;
  /** Является ли встроенным (core) расширением */
  isBuiltin?: boolean;
  /** Рабочие столы, которые предоставляет расширение */
  desktops?: IExtensionDesktop[];
}

export interface IExtensionDesktop {
  name: string;
  title: string;
  icon?: string;
  defaultRoute?: string;
}

export interface IExtensionFrontendManifest {
  /** Путь к install.ts/js файлу расширения для desktop */
  installPath: string;
  /** Маршруты, которые расширение регистрирует */
  routes?: any[];
}

/**
 * Главный контракт расширения.
 * Расширение экспортирует default-объект, реализующий этот интерфейс.
 */
export interface IExtensionModule {
  /** Метаданные расширения */
  getMetadata(): IExtensionMetadata;

  /** NestJS-модуль для подключения к серверу */
  getBackendModule(): any;

  /** Манифест фронтенда (опционально) */
  getFrontendManifest?(): IExtensionFrontendManifest;

  /**
   * Zod-схема конфигурации расширения (для настроек в UI).
   * Если не задана, расширение не имеет настраиваемых параметров.
   */
  getConfigSchema?(): any;

  /**
   * Фабрика NestJS-плагина для миграций схемы при обновлении.
   * Если не задана, расширение не требует миграций.
   */
  getPluginClass?(): any;
}
