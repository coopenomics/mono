import type { CapitalContract } from 'cooptypes';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Интерфейс данных долга из блокчейна
 */
export type IDebtBlockchainData = Omit<
  CapitalContract.Tables.Debts.IDebt,
  // Договор займа зеркало проекта не хранит: он живёт в общем реестре займов (приложение «Беспроцентные займы»).
  'statement' | 'approved_statement' | 'authorization' | 'contract' | 'signed_contract'
> & {
  statement: ISignedDocument;
  approved_statement: ISignedDocument;
  authorization: ISignedDocument;
};
