import type { ISignedDocument } from '@coopenomics/innercoop';

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
  proposal: ISignedDocument;
  /** Место проведения собрания — приватные данные пайщиков, хранятся только в БД */
  meet_place: string;
  /** Время проведения собрания — приватные данные пайщиков, хранятся только в БД */
  meet_at: string;
}

export interface JoinKuDecisionInputDomainInterface {
  coopname: string;
  hash: string;
  username: string;
}

export interface StartKuDecisionInputDomainInterface {
  coopname: string;
  hash: string;
  /** Избираемый председатель кооперативного участка — из присоединившихся участников */
  chairman: string;
  /** Адрес привязки кооперативного участка, определённый собранием */
  address: string;
  /** Человекочитаемое наименование участка («РОМАШКА») — в блокчейн не публикуется */
  branch_name: string;
  /** Email участка — в блокчейн не публикуется */
  branch_email: string;
  /** Телефон участка — в блокчейн не публикуется */
  branch_phone: string;
  /** Дополнительные вопросы повестки, внесённые на собрании */
  agenda: KuAgendaPointInputDomainInterface[];
}

export interface KuVoteItemInputDomainInterface {
  question_id: number;
  vote: string;
}

export interface VoteOnKuDecisionInputDomainInterface {
  coopname: string;
  hash: string;
  username: string;
  ballot: ISignedDocument;
  votes: KuVoteItemInputDomainInterface[];
}

export interface CloseKuDecisionInputDomainInterface {
  coopname: string;
  hash: string;
  protocol: ISignedDocument;
}

export interface ExecKuDecisionInputDomainInterface {
  coopname: string;
  hash: string;
  petition: ISignedDocument;
  liability: ISignedDocument;
  authority: ISignedDocument;
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
  application: ISignedDocument;
  authority: ISignedDocument;
}

export interface ApproveKuTrustedInputDomainInterface {
  coopname: string;
  hash: string;
  countersigned: ISignedDocument;
  countersigned_authority: ISignedDocument;
}

export interface DeclineKuTrustedInputDomainInterface {
  coopname: string;
  hash: string;
  reason: string;
}
