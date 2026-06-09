import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

// Сырой селектор для OperatorWallet
export const rawOperatorWalletSelector = {
  program_id: true,
  program_type: true,
  available: true,
  blocked: true,
  membership_contribution: true,
}

// Валидация селектора
const _validate: MakeAllFieldsRequired<ValueTypes['OperatorWallet']> = rawOperatorWalletSelector

/**
 * Селектор для баланса кошелька организации на бэкенде кооператива-оператора
 */
export const operatorWalletSelector = Selector('OperatorWallet')(rawOperatorWalletSelector)

export type OperatorWalletType = ModelTypes['OperatorWallet']
