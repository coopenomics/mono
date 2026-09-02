/** Доменные события «Образовательного моста»: `edubridge.<subject>.<event>`. */
export const EDUBRIDGE_ENROLLMENT_OPENED_EVENT = 'edubridge.enrollment.opened';
export const EDUBRIDGE_ENROLLMENT_EXTENDED_EVENT = 'edubridge.enrollment.extended';
export const EDUBRIDGE_ENROLLMENT_EXPIRED_EVENT = 'edubridge.enrollment.expired';
export const EDUBRIDGE_LEARNER_RECIPIENT_CHANGED_EVENT = 'edubridge.learner.recipient_changed';
export const EDUBRIDGE_ACCESS_GRANTED_EVENT = 'edubridge.access.granted';
export const EDUBRIDGE_ACCESS_REVOKED_EVENT = 'edubridge.access.revoked';
export const EDUBRIDGE_ACCESS_NEEDS_ATTENTION_EVENT = 'edubridge.access.needs_attention';
export const EDUBRIDGE_CONTRIBUTION_SUBMITTED_EVENT = 'edubridge.contribution.submitted';
export const EDUBRIDGE_CONTRIBUTION_DECIDED_EVENT = 'edubridge.contribution.decided';

export interface IEduEnrollmentEventPayload {
  coopname: string;
  enrollment_id: string;
  learner_id: string;
  course_id: string;
  member_username: string;
  /** Транзакция цепи, породившая событие (дедупликация задач outbox). */
  trx_id: string;
}

export interface IEduLearnerRecipientChangedPayload {
  coopname: string;
  learner_id: string;
  previous_recipient_type: string;
  previous_recipient_value: string;
  trigger: string;
}
/** Председатель подписал или отклонил договор УХД / приложение (коллбэк контракта совета). */
export const EDUBRIDGE_CONTRACT_DECIDED_EVENT = 'edubridge.contract.decided';
export const EDUBRIDGE_ANNEX_DECIDED_EVENT = 'edubridge.annex.decided';
