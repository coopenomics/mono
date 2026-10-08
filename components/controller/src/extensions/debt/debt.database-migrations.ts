import { DebtBaseline1791000000000 } from './migrations/database/1791000000000-baseline';

/**
 * Миграции таблиц расширения — в порядке появления. Объявляются в записи
 * реестра (`databaseMigrations`): вынесенное расширение уносит историю своих
 * таблиц с собой.
 */
export const debtDatabaseMigrations = [DebtBaseline1791000000000];
