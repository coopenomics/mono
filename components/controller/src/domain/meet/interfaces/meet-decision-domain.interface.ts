import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';

export interface MeetQuestionResultDomainInterface {
  question_id: number;
  number: number;
  title: string;
  decision: string;
  context: string;
  votes_for: number;
  votes_against: number;
  votes_abstained: number;
  accepted: boolean;
}

export interface MeetDecisionDomainInterface {
  coopname: string;
  hash: string;
  presider: string;
  secretary: string;
  results: MeetQuestionResultDomainInterface[];
  signed_ballots: number;
  quorum_percent: number;
  quorum_passed: boolean;
  decision: ISignedDocumentDomainInterface;
}
