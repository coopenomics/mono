import { ExpensesBaseline1790197276756 } from './migrations/database/1790197276756-baseline';
import { ExpensesBankSafePaymentPurpose1793946254663 } from './migrations/database/1793946254663-bank-safe-payment-purpose';

/**
 * Миграции таблиц расширения — в порядке появления (метка времени в имени
 * класса). Объявляются в записи реестра (`databaseMigrations`) рядом с
 * сущностями, и файлы лежат здесь же: вынесенное расширение уносит историю
 * своих таблиц с собой. Новую миграцию `pnpm schema:generate` дописывает сюда.
 */
export const expensesDatabaseMigrations = [ExpensesBaseline1790197276756, ExpensesBankSafePaymentPurpose1793946254663];
