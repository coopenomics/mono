import { ChatcoopBaseline1790197276755 } from './migrations/database/1790197276755-baseline';
import { ChatcoopDropMatrixTokens1791180293748 } from './migrations/database/1791180293748-drop-matrix-tokens';

/**
 * Миграции таблиц расширения — в порядке появления (метка времени в имени
 * класса). Объявляются в записи реестра (`databaseMigrations`) рядом с
 * сущностями, и файлы лежат здесь же: вынесенное расширение уносит историю
 * своих таблиц с собой. Новую миграцию `pnpm schema:generate` дописывает сюда.
 */
export const chatcoopDatabaseMigrations = [ChatcoopBaseline1790197276755, ChatcoopDropMatrixTokens1791180293748];
