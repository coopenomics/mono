import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Строка таблицы `debts` контракта `debt` (scope = coopname) в виде зеркала:
 * документы уже переведены в доменный формат.
 */
export interface ILoanBlockchainData {
  id: number | string;
  coopname: string;
  username: string;
  status: string;
  debt_hash: string;
  collateral: string;
  source: string;
  source_ref: string;
  amount: string;
  remaining: string;
  pledged: string;
  created_at: string;
  issued_at: string;
  due_at: string;
  requested_due_at: string;
  overdue_at: string;
  statement?: ISignedDocument;
  contract?: ISignedDocument;
  signed_contract?: ISignedDocument;
  decision?: ISignedDocument;
  extension_statement?: ISignedDocument;
  last_pay_error: string;
  memo: string;
}
