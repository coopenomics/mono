import type { ISignedDocument } from '@coopenomics/innercoop';

/** Доменный ввод для действия createpinv (программная денежная инвестиция) */
export interface CreateProgramInvestDomainInput {
  coopname: string;
  username: string;
  invest_hash: string;
  amount: string;
  statement: ISignedDocument;
}
