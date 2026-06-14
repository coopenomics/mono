import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { paginationSelector } from '../../utils/paginationSelector'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawDocumentAggregateSelector } from '../documents/documentAggregateSelector'

// Вопрос повестки собрания пайщиков кооперативного участка
export const rawKuDecisionQuestionSelector = {
  id: true,
  decision_id: true,
  number: true,
  title: true,
  decision: true,
  context: true,
  counter_votes_for: true,
  counter_votes_against: true,
  counter_votes_abstained: true,
  voters_for: true,
  voters_against: true,
  voters_abstained: true,
}

const _validateQuestion: MakeAllFieldsRequired<ValueTypes['KuDecisionQuestion']> = rawKuDecisionQuestionSelector

export type kuDecisionQuestionModel = ModelTypes['KuDecisionQuestion']
export const kuDecisionQuestionSelector = Selector('KuDecisionQuestion')(rawKuDecisionQuestionSelector)

// Участник собрания с отображаемым именем (для выбора председателя по ФИО)
export const rawKuMeetingParticipantSelector = {
  username: true,
  display_name: true,
}

const _validateParticipant: MakeAllFieldsRequired<ValueTypes['KuMeetingParticipant']> =
  rawKuMeetingParticipantSelector

export type kuMeetingParticipantModel = ModelTypes['KuMeetingParticipant']

// Решение собрания пайщиков кооперативного участка
export const rawKuDecisionSelector = {
  hash: true,
  id: true,
  coopname: true,
  type: true,
  initiator: true,
  chairman: true,
  status: true,
  present: true,
  proposal: true,
  protocol: true,
  petition: true,
  authorization: true,
  // протокол собрания (323) и решение совета (325) агрегатами — для просмотра на странице собрания
  protocol_document: rawDocumentAggregateSelector,
  authorization_document: rawDocumentAggregateSelector,
  open_at: true,
  close_at: true,
  signed_ballots: true,
  braname: true,
  address: true,
  participants: true,
  participants_info: rawKuMeetingParticipantSelector,
  created_at: true,
  meet_place: true,
  meet_at: true,
  branch_name: true,
  branch_email: true,
  branch_phone: true,
  questions: rawKuDecisionQuestionSelector,
  block_num: true,
}

const _validateDecision: MakeAllFieldsRequired<ValueTypes['KuDecision']> = rawKuDecisionSelector

export type kuDecisionModel = ModelTypes['KuDecision']
export const kuDecisionSelector = Selector('KuDecision')(rawKuDecisionSelector)

// Заявка на приём доверенным лицом кооперативного участка
export const rawKuTrustRequestSelector = {
  hash: true,
  id: true,
  coopname: true,
  braname: true,
  username: true,
  display_name: true,
  present: true,
  application: true,
  authority: true,
  // договор заявителя с сырым документом — для просмотра и встречной подписи председателя
  document: rawDocumentAggregateSelector,
  // доверенность заявителя с сырым документом — для просмотра и встречной подписи председателя
  authority_document: rawDocumentAggregateSelector,
  block_num: true,
}

const _validateTrustRequest: MakeAllFieldsRequired<ValueTypes['KuTrustRequest']> = rawKuTrustRequestSelector

export type kuTrustRequestModel = ModelTypes['KuTrustRequest']
export const kuTrustRequestSelector = Selector('KuTrustRequest')(rawKuTrustRequestSelector)

// Пагинированный селектор решений собраний участков
const rawKuDecisionsPaginationSelector = { ...paginationSelector, items: rawKuDecisionSelector }
const _validateDecisionsPagination: MakeAllFieldsRequired<ValueTypes['PaginatedKuDecisionsPaginationResult']>
  = rawKuDecisionsPaginationSelector
export type kuDecisionsPaginationModel = ModelTypes['PaginatedKuDecisionsPaginationResult']
export const kuDecisionsPaginationSelector = Selector('PaginatedKuDecisionsPaginationResult')(
  rawKuDecisionsPaginationSelector,
)

// Пагинированный селектор заявок доверенных
const rawKuTrustRequestsPaginationSelector = { ...paginationSelector, items: rawKuTrustRequestSelector }
const _validateTrustRequestsPagination: MakeAllFieldsRequired<ValueTypes['PaginatedKuTrustRequestsPaginationResult']>
  = rawKuTrustRequestsPaginationSelector
export type kuTrustRequestsPaginationModel = ModelTypes['PaginatedKuTrustRequestsPaginationResult']
export const kuTrustRequestsPaginationSelector = Selector('PaginatedKuTrustRequestsPaginationResult')(
  rawKuTrustRequestsPaginationSelector,
)
