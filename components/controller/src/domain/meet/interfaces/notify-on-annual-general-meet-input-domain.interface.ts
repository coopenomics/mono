import { type ISignedDocument } from '@coopenomics/innercoop';

export interface NotifyOnAnnualGeneralMeetInputDomainInterface {
  coopname: string;
  meet_hash: string;
  username: string;
  notification: ISignedDocument;
}
