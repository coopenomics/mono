import { SovietRobotBaseline1790197276760 } from './migrations/database/1790197276760-baseline';

/**
 * Миграции таблиц расширения — в порядке появления (метка времени в имени
 * класса). Объявляются в записи реестра (`databaseMigrations`) рядом с
 * сущностями, и файлы лежат здесь же: вынесенное расширение уносит историю
 * своих таблиц с собой. Новую миграцию `pnpm schema:generate` дописывает сюда.
 */
export const sovietRobotDatabaseMigrations = [SovietRobotBaseline1790197276760];
