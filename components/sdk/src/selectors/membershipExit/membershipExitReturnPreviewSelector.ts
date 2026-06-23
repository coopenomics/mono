import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

// Сырой селектор для MembershipExitReturnPreview
export const rawMembershipExitReturnPreviewSelector = {
  total: true,
  share_contribution: true,
  minimum_contribution: true,
}

// Валидация селектора
const _validate: MakeAllFieldsRequired<ValueTypes['MembershipExitReturnPreview']> =
  rawMembershipExitReturnPreviewSelector

/**
 * Селектор предварительного расчёта суммы возврата паевого при выходе
 */
export const membershipExitReturnPreviewSelector = Selector('MembershipExitReturnPreview')(
  rawMembershipExitReturnPreviewSelector
)

export type MembershipExitReturnPreviewType = ModelTypes['MembershipExitReturnPreview']
