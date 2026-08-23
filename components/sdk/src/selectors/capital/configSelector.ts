import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { baseCapitalSelector } from './baseCapitalSelector'

const rawConfigSelector = {
  ...baseCapitalSelector,
  coopname: true,
  global_available_invest_pool: true,
  program_expense_pool: true,
  program_expense_reserved: true,
  program_membership_available: true,
  program_membership_cumulative_reward_per_share: true,
  program_membership_distributed: true,
  program_membership_funded: true,
  config: {
    coordinator_bonus_percent: true,
    expense_pool_percent: true,
    coordinator_invite_validity_days: true,
    voting_period_in_days: true,
    authors_voting_percent: true,
    creators_voting_percent: true,    
    energy_decay_rate_per_day: true, 
    energy_gain_coefficient: true, 
    level_depth_base: true, 
    level_growth_coefficient: true
  },
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CapitalState']> = rawConfigSelector

export type configModel = ModelTypes['CapitalState']

export const configSelector = Selector('CapitalState')(rawConfigSelector)
export { rawConfigSelector }
