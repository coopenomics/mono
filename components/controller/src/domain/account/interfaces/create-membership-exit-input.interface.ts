import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Входные данные подачи заявления на выход пайщика из кооператива.
 */
export interface CreateMembershipExitInputDomainInterface {
  coopname: string;
  username: string;
  exit_hash: string;
  statement: ISignedDocument;
}
