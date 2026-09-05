import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { paginationSelector } from '../../utils/paginationSelector'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

// Член совета, делегировавший роботу голос по типу решения
export const rawRobotVoterSelector = {
  member: true,
  permission_name: true,
  has_key: true,
  limit: true,
  expires_at: true,
}
const _validateVoter: MakeAllFieldsRequired<ValueTypes['RobotVoter']> = rawRobotVoterSelector

// Кворум робота по типу решения
export const rawRobotQuorumSelector = {
  delegated_count: true,
  required_count: true,
  total_members: true,
  reached: true,
}
const _validateQuorum: MakeAllFieldsRequired<ValueTypes['RobotQuorum']> = rawRobotQuorumSelector

// Автоматическая подпись протоколов председателем
export const rawRobotChairmanDelegationSelector = {
  username: true,
  delegated: true,
  has_key: true,
}
const _validateChairman: MakeAllFieldsRequired<ValueTypes['RobotChairmanDelegation']> = rawRobotChairmanDelegationSelector

// Тип решения в реестре действий автоматизации
export const rawRobotDecisionTypeSelector = {
  type: true,
  title: true,
  description: true,
  area: true,
  protocol_registry_id: true,
  serviceable: true,
  voters: rawRobotVoterSelector,
  vote_quorum: rawRobotQuorumSelector,
  chairman: rawRobotChairmanDelegationSelector,
  my_vote: true,
  my_authorize: true,
}
const _validateType: MakeAllFieldsRequired<ValueTypes['RobotDecisionType']> = rawRobotDecisionTypeSelector

export type robotDecisionTypeModel = ModelTypes['RobotDecisionType']
export const robotDecisionTypeSelector = Selector('RobotDecisionType')(rawRobotDecisionTypeSelector)

// Голос, поданный роботом
export const rawRobotVoteRecordSelector = {
  member: true,
  permission: true,
  tx_id: true,
  at: true,
}
const _validateVote: MakeAllFieldsRequired<ValueTypes['RobotVoteRecord']> = rawRobotVoteRecordSelector

// Решение в журнале робота
export const rawRobotDecisionSelector = {
  id: true,
  coopname: true,
  decision_id: true,
  decision_type: true,
  decision_hash: true,
  username: true,
  stage: true,
  votes: rawRobotVoteRecordSelector,
  protocol_hash: true,
  tx_hashes: true,
  last_error: true,
  attempts: true,
  next_attempt_at: true,
  created_at: true,
  updated_at: true,
}
const _validateDecision: MakeAllFieldsRequired<ValueTypes['RobotDecision']> = rawRobotDecisionSelector

export type robotDecisionModel = ModelTypes['RobotDecision']
export const robotDecisionSelector = Selector('RobotDecision')(rawRobotDecisionSelector)

const rawRobotDecisionsPaginationSelector = { ...paginationSelector, items: rawRobotDecisionSelector }
const _validatePagination: MakeAllFieldsRequired<ValueTypes['PaginatedRobotDecisionsPaginationResult']>
  = rawRobotDecisionsPaginationSelector
export const robotDecisionsPaginationSelector = Selector('PaginatedRobotDecisionsPaginationResult')(
  rawRobotDecisionsPaginationSelector,
)

// Состояние ключа робота у члена совета
export const rawRobotKeyStatusSelector = {
  member: true,
  permission_name: true,
  has_key: true,
  public_key: true,
  chain_has_permission: true,
  chain_key_matches: true,
  updated_at: true,
}
const _validateKey: MakeAllFieldsRequired<ValueTypes['RobotKeyStatus']> = rawRobotKeyStatusSelector

export type robotKeyStatusModel = ModelTypes['RobotKeyStatus']
export const robotKeyStatusSelector = Selector('RobotKeyStatus')(rawRobotKeyStatusSelector)

// Совет кооператива глазами робота
export const rawRobotCouncilMemberSelector = {
  username: true,
  is_voting: true,
  position: true,
  position_title: true,
}
const _validateCouncilMember: MakeAllFieldsRequired<ValueTypes['RobotCouncilMember']> = rawRobotCouncilMemberSelector

export const rawRobotCouncilSelector = {
  board_id: true,
  chairman: true,
  required_votes: true,
  members: rawRobotCouncilMemberSelector,
}
const _validateCouncil: MakeAllFieldsRequired<ValueTypes['RobotCouncil']> = rawRobotCouncilSelector

export type robotCouncilModel = ModelTypes['RobotCouncil']
export const robotCouncilSelector = Selector('RobotCouncil')(rawRobotCouncilSelector)
