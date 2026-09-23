import type { MigrationInterface } from 'typeorm';

/**
 * Миграции таблиц установленных расширений — то, что контроллер отдаёт TypeORM
 * вместе с миграциями ядра.
 *
 * Схему базы меняют только миграции: `synchronize` выключен, потому что он молча
 * удаляет колонки, которых нет в сущности, и превращает переименование в потерю
 * данных. Таблицы расширения описывает оно само — списком `databaseMigrations`
 * в записи реестра, — и файлы миграций лежат в его каталоге: расширение,
 * вынесенное из монолита, уносит историю своих таблиц с собой.
 *
 * Порядок применения задаёт метка времени в имени класса (так TypeORM сортирует
 * миграции), поэтому миграции ядра и расширений идут одной лентой.
 *
 * Список задаётся один раз, до инициализации подключения, — как и состав
 * сущностей (`registerExtensionEntities`).
 */
export type ExtensionDatabaseMigrationClass = new () => MigrationInterface;

let migrations: ReadonlyArray<ExtensionDatabaseMigrationClass> | undefined;

/** Объявить миграции таблиц установленных расширений. Вызывает composition root. */
export function registerExtensionDatabaseMigrations(list: ReadonlyArray<ExtensionDatabaseMigrationClass>): void {
  if (migrations) {
    throw new Error(
      'Миграции таблиц расширений уже объявлены: registerExtensionDatabaseMigrations() вызывается один раз при старте'
    );
  }
  migrations = [...list];
}

/**
 * Прочитать миграции таблиц расширений.
 *
 * До объявления возвращает пустой список: подключение к базе поднимается и в
 * контурах без единого расширения.
 */
export function extensionDatabaseMigrations(): ReadonlyArray<ExtensionDatabaseMigrationClass> {
  return migrations ?? [];
}

/** Сбросить список. Только для тестов, которые поднимают граф модулей заново. */
export function resetExtensionDatabaseMigrations(): void {
  migrations = undefined;
}
