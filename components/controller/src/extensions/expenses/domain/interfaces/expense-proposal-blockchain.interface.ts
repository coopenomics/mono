import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Колбэк, который контракт `expense` опубликует в `dispatcher` при закрытии СЗ.
 * `contract.value === 0` означает «колбэка нет».
 */
export interface IExpenseProposalCallbackHandler {
  contract: string;
  action: string;
  data: string;
}

/**
 * Item — одна строка СЗ-расхода в `proposals.items` контракта `expense`.
 * Зеркалит `ExpenseDomain::item`.
 */
export interface IExpenseItemBlockchainData {
  item_hash: string;
  mechanics: number;
  recipient_type: number;
  recipient: string;
  description: string;
  planned_amount: string;
  actual_amount: string;
  status: number;
}

/**
 * СЗ-расход — строка `proposals` контракта `expense` (scope = coopname).
 * Зеркалит `ExpenseDomain::proposal`.
 */
export interface IExpenseProposalBlockchainData {
  id: string;
  proposal_hash: string;
  coopname: string;
  username: string;
  source_wallet: string;
  status: number;
  items: IExpenseItemBlockchainData[];
  total_planned: string;
  total_actual: string;
  callback?: IExpenseProposalCallbackHandler;
  statement_doc?: ISignedDocumentDomainInterface;
  decision_doc?: ISignedDocumentDomainInterface;
  created_at: string;
  updated_at: string;
}
