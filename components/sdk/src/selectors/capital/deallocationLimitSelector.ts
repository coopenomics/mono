import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawDeallocationLimitSelector = {
  max_amount: true,
  program_invest_pool: true,
  unspent: true,
  outstanding_debt: true,
  is_allowed_by_status: true,
}

// Проверка валидности
const _validate: MakeAllFieldsRequired<ValueTypes['CapitalDeallocationLimit']> = rawDeallocationLimitSelector

export type deallocationLimitModel = ModelTypes['CapitalDeallocationLimit']

export const deallocationLimitSelector = Selector('CapitalDeallocationLimit')(rawDeallocationLimitSelector)
export { rawDeallocationLimitSelector }
