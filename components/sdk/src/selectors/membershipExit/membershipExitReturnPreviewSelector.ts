import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

// Кошелёк пайщика в предрасчёте выхода
const rawMembershipExitWalletSelector = {
  wallet_name: true,
  human_name: true,
  balance: true,
  returns: true,
  policy: true,
}
const _validateWallet: MakeAllFieldsRequired<ValueTypes['MembershipExitWallet']> = rawMembershipExitWalletSelector

// Программа пайщика в предрасчёте выхода
const rawMembershipExitProgramSelector = {
  program_id: true,
  title: true,
  agreement_signed_at: true,
  agreement_hash: true,
  refund: true,
  wallets: rawMembershipExitWalletSelector,
}
const _validateProgram: MakeAllFieldsRequired<ValueTypes['MembershipExitProgram']> = rawMembershipExitProgramSelector

// Сырой селектор для MembershipExitReturnPreview
export const rawMembershipExitReturnPreviewSelector = {
  total: true,
  share_contribution: true,
  minimum_contribution: true,
  blockers: true,
  programs: rawMembershipExitProgramSelector,
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
