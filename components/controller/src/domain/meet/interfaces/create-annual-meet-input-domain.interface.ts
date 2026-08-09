import type { MeetContract } from 'cooptypes';
import type { ISignedDocument } from '@coopenomics/innercoop';

export type CreateAnnualGeneralMeetInputDomainInterface = Omit<
  MeetContract.Actions.CreateMeet.IInput,
  'proposal' | 'open_at' | 'close_at' | 'hash'
> & {
  proposal: ISignedDocument;
  open_at: Date;
  close_at: Date;
  hash?: string;
  details?: string | null;
};
