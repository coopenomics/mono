import { DebtBaseline1791000000000 } from './migrations/database/1791000000000-baseline';
import { DebtPledgeDocuments1791000000002 } from './migrations/database/1791000000002-pledge-documents';

/**
 * Миграции таблиц расширения — в порядке появления. Объявляются в записи
 * реестра (`databaseMigrations`): вынесенное расширение уносит историю своих
 * таблиц с собой.
 */
export const debtDatabaseMigrations = [DebtBaseline1791000000000, DebtPledgeDocuments1791000000002];
