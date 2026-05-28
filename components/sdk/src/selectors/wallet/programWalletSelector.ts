import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

/**
 * Сырой селектор для программного кошелька
 */
export const rawProgramWalletSelector = {
  id: true,
  coopname: true,
  program_id: true,
  agreement_id: true,
  username: true,
  available: true,
  membership_contribution: true,
  program_type: true,
  blockNum: true,
}

/**
 * Валидация селектора
 */
const _validate: MakeAllFieldsRequired<ValueTypes['ProgramWallet']> = rawProgramWalletSelector

/**
 * Селектор для программного кошелька
 */
export const programWalletSelector = Selector('ProgramWallet')(rawProgramWalletSelector)

/**
 * Типы для работы с программными кошельками
 */
export type ProgramWallet = ModelTypes['ProgramWallet']
