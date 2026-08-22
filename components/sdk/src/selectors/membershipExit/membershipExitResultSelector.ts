import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

// Сырой селектор для MembershipExitResult
export const rawMembershipExitResultSelector = {
  exit_hash: true,
  status: true,
}

// Валидация селектора
const _validate: MakeAllFieldsRequired<ValueTypes['MembershipExitResult']> = rawMembershipExitResultSelector

/**
 * Селектор результата подачи заявления на выход из кооператива
 */
export const membershipExitResultSelector = Selector('MembershipExitResult')(rawMembershipExitResultSelector)

export type MembershipExitResultType = ModelTypes['MembershipExitResult']
