import type { MeetContract } from 'cooptypes';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';
import { assertType, type AssertKeysMatch } from '~/shared/asserts/blockchain-type.assert';

export interface MeetRowProcessingDomainInterface {
  id: number;
  hash: string;
  coopname: string;
  type: string;
  level: string;
  initiator: string;
  presider: string;
  secretary: string;
  status: string;
  created_at: Date;
  open_at: Date;
  close_at: Date;
  quorum_percent: number;
  signed_ballots: number;
  current_quorum_percent: number;
  cycle: number;
  quorum_passed: boolean;
  proposal: ISignedDocumentDomainInterface;
  authorization?: ISignedDocumentDomainInterface;
  decision1?: ISignedDocumentDomainInterface;
  decision2?: ISignedDocumentDomainInterface;
  notified_users: string[];
}

assertType<AssertKeysMatch<MeetContract.Tables.Meets.IOutput, MeetRowProcessingDomainInterface>>();
