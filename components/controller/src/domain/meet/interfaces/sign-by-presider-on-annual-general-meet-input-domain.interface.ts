import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Доменный интерфейс для подписи решения председателем
 */
export interface SignByPresiderOnAnnualGeneralMeetInputDomainInterface {
  coopname: string;
  hash: string;
  username: string;
  presider_decision: ISignedDocument;
}
