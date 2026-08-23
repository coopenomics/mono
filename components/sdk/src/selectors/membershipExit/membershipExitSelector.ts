import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

// Сырой селектор для MembershipExit (текущий процесс выхода)
export const rawMembershipExitSelector = {
  exit_hash: true,
  status: true,
  quantity: true,
  payment_status: true,
  created_at: true,
}

// Валидация селектора
const _validate: MakeAllFieldsRequired<ValueTypes['MembershipExit']> = rawMembershipExitSelector

/**
 * Селектор текущего процесса выхода пайщика из кооператива
 */
export const membershipExitSelector = Selector('MembershipExit')(rawMembershipExitSelector)

export type MembershipExitType = ModelTypes['MembershipExit']
