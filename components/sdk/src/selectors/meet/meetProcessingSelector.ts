import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawUserCertificateUnionSelector } from '../common/userCertificateUnionSelector'
import { rawDocumentAggregateSelector } from '../documents/documentAggregateSelector'

// Селектор для Question
const rawQuestionSelector = {
  id: true,
  number: true,
  coopname: true,
  meet_id: true,
  title: true,
  context: true,
  decision: true,
  counter_votes_for: true,
  counter_votes_against: true,
  counter_votes_abstained: true,
  voters_for: true,
  voters_against: true,
  voters_abstained: true,
}

// Селектор для Meet
const rawMeetSelector = {
  id: true,
  hash: true,
  coopname: true,
  type: true,
  initiator: true,
  initiator_certificate: rawUserCertificateUnionSelector,
  presider: true,
  presider_certificate: rawUserCertificateUnionSelector,
  secretary: true,
  secretary_certificate: rawUserCertificateUnionSelector,
  status: true,
  created_at: true,
  open_at: true,
  close_at: true,
  quorum_percent: true,
  signed_ballots: true,
  current_quorum_percent: true,
  cycle: true,
  quorum_passed: true,
  proposal: rawDocumentAggregateSelector,
  authorization: rawDocumentAggregateSelector,
  decision1: rawDocumentAggregateSelector,
  decision2: rawDocumentAggregateSelector,
  notified_users: true,
  level: true,
}

// Право текущего пайщика на собрании: голос, подтверждение уведомления, председатель участка
const rawMeetParticipationSelector = {
  isTrusteesMeet: true,
  canVote: true,
  canNotify: true,
  branchVoted: true,
  branchTrustee: true,
  branchTrusteeCertificate: rawUserCertificateUnionSelector,
}

{
  const _validate: MakeAllFieldsRequired<ValueTypes['MeetParticipation']> = rawMeetParticipationSelector
}

// Селектор для MeetProcessing
const rawMeetProcessingSelector = {
  hash: true,
  meet: rawMeetSelector,
  questions: rawQuestionSelector,
  isVoted: true,
  extendedStatus: true,
  participation: rawMeetParticipationSelector,
}

// Проверка валидности MeetProcessing
{
  const _validate: MakeAllFieldsRequired<ValueTypes['MeetProcessing']> = rawMeetProcessingSelector
}

export type meetProcessingModel = ModelTypes['MeetProcessing']
export const meetProcessingSelector = Selector('MeetProcessing')(rawMeetProcessingSelector)
export type meetParticipationModel = ModelTypes['MeetParticipation']
export { rawMeetParticipationSelector, rawMeetProcessingSelector, rawMeetSelector, rawQuestionSelector }
