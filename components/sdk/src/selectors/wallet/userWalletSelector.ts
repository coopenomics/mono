import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

/**
 * Сырой селектор кошелька пайщика «как есть» (без сворачивания share+member).
 */
export const rawUserWalletSelector = {
  id: true,
  coopname: true,
  wallet_name: true,
  human_name: true,
  program_id: true,
  username: true,
  available: true,
  blocked: true,
}

/**
 * Валидация селектора
 */
const _validate: MakeAllFieldsRequired<ValueTypes['UserWallet']> = rawUserWalletSelector

/**
 * Селектор кошелька пайщика
 */
export const userWalletSelector = Selector('UserWallet')(rawUserWalletSelector)

/**
 * Тип кошелька пайщика
 */
export type UserWallet = ModelTypes['UserWallet']
