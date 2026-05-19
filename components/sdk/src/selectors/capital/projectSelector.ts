import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { baseCapitalSelector } from './baseCapitalSelector'

// Селекторы для вложенных объектов проекта
const rawProjectCountsDataSelector = {
  total_unique_participants: true,
  total_authors: true,
  total_coordinators: true,
  total_creators: true,
  total_investors: true,
  total_propertors: true,
  total_contributors: true,
  total_commits: true,
}

const rawProjectPlanPoolSelector = {
  hour_cost: true,
  creators_hours: true,
  return_base_percent: true,
  use_invest_percent: true,
  creators_base_pool: true,
  authors_base_pool: true,
  coordinators_base_pool: true,
  creators_bonus_pool: true,
  authors_bonus_pool: true,
  contributors_bonus_pool: true,
  target_expense_pool: true,
  invest_pool: true,
  coordinators_investment_pool: true,
  program_invest_pool: true,
  total_received_investments: true,
  total_generation_pool: true,
  total: true,
  total_with_investments: true,
}

const rawProjectFactPoolSelector = {
  hour_cost: true,
  creators_hours: true,
  return_base_percent: true,
  use_invest_percent: true,
  creators_base_pool: true,
  authors_base_pool: true,
  coordinators_base_pool: true,
  property_base_pool: true,
  creators_bonus_pool: true,
  authors_bonus_pool: true,
  contributors_bonus_pool: true,
  target_expense_pool: true,
  accumulated_expense_pool: true,
  used_expense_pool: true,
  invest_pool: true,
  coordinators_investment_pool: true,
  program_invest_pool: true,
  total_received_investments: true,
  total_returned_investments: true,
  total_generation_pool: true,
  total_contribution: true,
  total: true,
  total_with_investments: true,
  total_used_investments: true,
}

const rawProjectCrpsDataSelector = {
  total_capital_contributors_shares: true,
  author_base_cumulative_reward_per_share: true,
  author_bonus_cumulative_reward_per_share: true,
  contributor_cumulative_reward_per_share: true,
}

const rawProjectVotingAmountsSelector = {
  authors_equal_spread: true,
  creators_direct_spread: true,
  authors_bonuses_on_voting: true,
  creators_bonuses_on_voting: true,
  total_voting_pool: true,
  active_voting_amount: true,
  equal_voting_amount: true,
  authors_equal_per_author: true,
}

const rawProjectVotingDataSelector = {
  total_voters: true,
  votes_received: true,
  authors_voting_percent: true,
  creators_voting_percent: true,
  voting_deadline: true,
  amounts: rawProjectVotingAmountsSelector,
}

// Селектор для прав доступа к проекту
const rawProjectPermissionsSelector = {
  can_edit_project: true,
  can_manage_issues: true,
  can_change_project_status: true,
  can_delete_project: true,
  can_set_master: true,
  can_manage_authors: true,
  can_set_plan: true,
  has_clearance: true,
  pending_clearance: true,
  has_parent_clearance: true,
  can_view_artifacts: true,
  is_guest: true,
  can_create_requirement: true,
  can_edit_requirement: true,
  can_delete_requirement: true,
  can_complete_requirement: true,
}

const rawBaseProjectSelector = {
  ...baseCapitalSelector,
  id: true,
  prefix: true,
  issue_counter: true,
  status: true,
  project_hash: true,
  coopname: true,
  parent_hash: true,
  parent_title: true,
  blockchain_status: true,
  is_opened: true,
  is_planed: true,
  data: true,
  invite: true,
  master: true,
  title: true,
  description: true,
  /** URL репозитория для опроса маркеров коммитов (PRD §6.2.1) */
  development_repository_url: true,
  meta: true,
  created_at: true,
  counts: rawProjectCountsDataSelector,
  plan: rawProjectPlanPoolSelector,
  fact: rawProjectFactPoolSelector,
  crps: rawProjectCrpsDataSelector,
  voting: rawProjectVotingDataSelector,
  permissions: rawProjectPermissionsSelector,
}

const rawProjectSelector = {
  ...rawBaseProjectSelector,
  components: rawBaseProjectSelector,
}

// Проверки валидности типов
const _validateCountsData: MakeAllFieldsRequired<ValueTypes['CapitalProjectCountsData']> = rawProjectCountsDataSelector
const _validatePlanPool: MakeAllFieldsRequired<ValueTypes['CapitalProjectPlanPool']> = rawProjectPlanPoolSelector
const _validateFactPool: MakeAllFieldsRequired<ValueTypes['CapitalProjectFactPool']> = rawProjectFactPoolSelector
const _validateCrpsData: MakeAllFieldsRequired<ValueTypes['CapitalProjectCrpsData']> = rawProjectCrpsDataSelector
const _validateVotingData: MakeAllFieldsRequired<ValueTypes['CapitalProjectVotingData']> = rawProjectVotingDataSelector
const _validateVotingAmounts: MakeAllFieldsRequired<ValueTypes['CapitalProjectVotingAmounts']> = rawProjectVotingAmountsSelector
const _validateProject: MakeAllFieldsRequired<ValueTypes['CapitalProject']> = rawProjectSelector

// Экспорт типов моделей
export type projectModel = ModelTypes['CapitalProject']
export type projectCountsDataModel = ModelTypes['CapitalProjectCountsData']
export type projectPlanPoolModel = ModelTypes['CapitalProjectPlanPool']
export type projectFactPoolModel = ModelTypes['CapitalProjectFactPool']
export type projectCrpsDataModel = ModelTypes['CapitalProjectCrpsData']
export type projectVotingDataModel = ModelTypes['CapitalProjectVotingData']
export type projectVotingAmountsModel = ModelTypes['CapitalProjectVotingAmounts']

// Экспорт селекторов
export const projectSelector = Selector('CapitalProject')(rawProjectSelector)

// Экспорт сырых селекторов для переиспользования
export {
  rawBaseProjectSelector,
  rawProjectCountsDataSelector,
  rawProjectCrpsDataSelector,
  rawProjectFactPoolSelector,
  rawProjectPermissionsSelector,
  rawProjectPlanPoolSelector,
  rawProjectSelector,
  rawProjectVotingAmountsSelector,
  rawProjectVotingDataSelector,
}
