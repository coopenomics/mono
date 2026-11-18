import { KuBaseline1790197276757 } from './migrations/database/1790197276757-baseline';
import { KuPowersOfAttorney1795000000000 } from './migrations/database/1795000000000-powers-of-attorney';

/**
 * Миграции таблиц расширения — в порядке появления (метка времени в имени
 * класса). Объявляются в записи реестра (`databaseMigrations`) рядом с
 * сущностями, и файлы лежат здесь же: вынесенное расширение уносит историю
 * своих таблиц с собой. Новую миграцию `pnpm schema:generate` дописывает сюда.
 */
export const kuDatabaseMigrations = [KuBaseline1790197276757, KuPowersOfAttorney1795000000000];
