import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';
import { ExpenseItemStatus } from '../enums/expense-item-status.enum';

/**
 * Зеркало строки `items[]` СЗ-расхода. Хранится отдельной таблицей
 * (`expense_items`) ради per-item фильтров и присоединения файлов.
 */
export interface IExpenseItemDatabaseData extends IBaseDatabaseData {
  id?: number;
  proposal_hash: string;
  item_hash: string;
  status: ExpenseItemStatus;
}
