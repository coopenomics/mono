import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

/**
 * Сырой селектор для программного кошелька участника capital
 */
export const rawCapitalProgramWalletSelector = {
  id: true,
  coopname: true,
  program_id: true,
  agreement_id: true,
  username: true,
  available: true,
  membership_contribution: true,
  program_type: true,
}

/**
 * Валидация селектора
 */
const _validate: MakeAllFieldsRequired<ValueTypes['CapitalProgramWallet']> = rawCapitalProgramWalletSelector

/**
 * Селектор для программного кошелька участника capital
 */
export const capitalProgramWalletSelector = Selector('CapitalProgramWallet')(rawCapitalProgramWalletSelector)

/**
 * Тип программного кошелька участника capital
 */
export type CapitalProgramWallet = ModelTypes['CapitalProgramWallet']
