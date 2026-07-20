import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Входные данные подачи заявления на выход пайщика из кооператива.
 */
export interface CreateMembershipExitInputDomainInterface {
  coopname: string;
  username: string;
  exit_hash: string;
  statement: ISignedDocumentDomainInterface;
}
