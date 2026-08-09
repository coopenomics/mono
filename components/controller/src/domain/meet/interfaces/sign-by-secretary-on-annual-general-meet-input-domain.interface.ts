import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';
/**
 * Доменный интерфейс для подписи решения секретарём
 */
export interface SignBySecretaryOnAnnualGeneralMeetInputDomainInterface {
  coopname: string;
  hash: string;
  username: string;
  secretary_decision: ISignedDocumentDomainInterface;
}
