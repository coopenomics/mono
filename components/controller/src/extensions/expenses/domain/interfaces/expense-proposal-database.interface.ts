import type { IBaseDatabaseData } from '~/shared/sync/interfaces/base-database.interface';
import { ExpenseProposalStatus } from '../enums/expense-proposal-status.enum';

/**
 * Поля, которые живут в собственной таблице зеркала СЗ-расхода
 * (`expense_proposals`). Идентификация и нормализованный статус.
 */
export interface IExpenseProposalDatabaseData extends IBaseDatabaseData {
  id?: number;
  proposal_hash: string;
  coopname: string;
  status: ExpenseProposalStatus;
}
