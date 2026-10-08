import { ChainRecord } from '@coopenomics/extension-kit/sync';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { LoanStatus } from '../../domain/enums/loan-status.enum';

export const EntityName = 'debt_loans';

/** Строка таблицы `debt_loans` — зеркало `debt::debts` плюс служебные поля. */
export class LoanRecord extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }

  id!: number | null;
  debt_hash!: string;
  coopname!: string;
  username!: string;
  blockchain_status!: string | null;
  collateral!: string | null;
  source!: string | null;
  source_ref!: string | null;
  amount!: string | null;
  remaining!: string | null;
  pledged!: string | null;
  created_at!: Date | null;
  issued_at!: Date | null;
  due_at!: Date | null;
  requested_due_at!: Date | null;
  overdue_at!: Date | null;
  statement!: ISignedDocument | null;
  contract!: ISignedDocument | null;
  signed_contract!: ISignedDocument | null;
  decision!: ISignedDocument | null;
  extension_statement!: ISignedDocument | null;
  last_pay_error!: string | null;
  memo!: string | null;
  status!: LoanStatus;
}
