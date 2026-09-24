import { MarketplaceBaseline1790197276758 } from './migrations/database/1790197276758-baseline';

/**
 * Миграции таблиц расширения — в порядке появления (метка времени в имени
 * класса). Объявляются в записи реестра (`databaseMigrations`) рядом с
 * сущностями, и файлы лежат здесь же: вынесенное расширение уносит историю
 * своих таблиц с собой. Новую миграцию `pnpm schema:generate` дописывает сюда.
 */
export const marketplaceDatabaseMigrations = [MarketplaceBaseline1790197276758];
