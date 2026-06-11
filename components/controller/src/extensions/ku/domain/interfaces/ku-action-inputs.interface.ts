import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Доменные input-интерфейсы действий собрания пайщиков кооперативного участка
 * и приёма доверенных лиц (контракт branch).
 */

export interface KuAgendaPointInputDomainInterface {
  title: string;
  decision: string;
  context: string;
}

export interface CreateKuDecisionInputDomainInterface {
  coopname: string;
  hash: string;
  type: string;
  initiator: string;
  braname: string;
  agenda: KuAgendaPointInputDomainInterface[];
  proposal: ISignedDocumentDomainInterface;
}

export interface JoinKuDecisionInputDomainInterface {
  coopname: string;
  hash: string;
  username: string;
  statement: ISignedDocumentDomainInterface;
}

export interface SetKuDecisionChairmanInputDomainInterface {
  coopname: string;
  hash: string;
  chairman: string;
}

export interface StartKuDecisionInputDomainInterface {
  coopname: string;
  hash: string;
  address: string;
  open_at: string;
  close_at: string;
}

export interface KuVoteItemInputDomainInterface {
  question_id: number;
  vote: string;
}

export interface VoteOnKuDecisionInputDomainInterface {
  coopname: string;
  hash: string;
  username: string;
  ballot: ISignedDocumentDomainInterface;
  votes: KuVoteItemInputDomainInterface[];
}

export interface CloseKuDecisionInputDomainInterface {
  coopname: string;
  hash: string;
  protocol: ISignedDocumentDomainInterface;
}

export interface ExecKuDecisionInputDomainInterface {
  coopname: string;
  hash: string;
  petition: ISignedDocumentDomainInterface;
}

export interface CancelKuDecisionInputDomainInterface {
  coopname: string;
  hash: string;
  reason: string;
}

export interface RequestKuTrustedInputDomainInterface {
  coopname: string;
  braname: string;
  username: string;
  hash: string;
  application: ISignedDocumentDomainInterface;
}

export interface ApproveKuTrustedInputDomainInterface {
  coopname: string;
  hash: string;
  countersigned: ISignedDocumentDomainInterface;
}

export interface DeclineKuTrustedInputDomainInterface {
  coopname: string;
  hash: string;
  reason: string;
}
