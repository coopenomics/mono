import type { IBaseDatabaseData } from '@coopenomics/extension-kit/sync';
import { LoanStatus } from '../enums/loan-status.enum';

/** Поля собственной таблицы зеркала займов (`debt_loans`): идентификация и состояние. */
export interface ILoanDatabaseData extends IBaseDatabaseData {
  id?: number;
  debt_hash: string;
  coopname: string;
  status: LoanStatus;
}
