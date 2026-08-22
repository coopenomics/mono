import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Доменный интерфейс для закрытия собрания
 */
export interface CloseAnnualGeneralMeetInputDomainInterface {
  coopname: string;
  hash: string;
  meet_decision: ISignedDocument;
}
