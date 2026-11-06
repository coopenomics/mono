import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

/** Движение по кошельку пайщика: операция, кошелёк, направление, сумма, процесс. */
export const rawWalletMovementSelector = {
  global_sequence: true,
  created_at: true,
  operation_code: true,
  operation_name: true,
  wallet_name: true,
  wallet_title: true,
  from_title: true,
  to_title: true,
  to_cooperative: true,
  direction: true,
  quantity: true,
  process_hash: true,
  process_type: true,
  memo: true,
}

const _validateMovement: MakeAllFieldsRequired<ValueTypes['WalletMovement']> = rawWalletMovementSelector

/** Страница движений по кошелькам пайщика. */
export const rawWalletMovementsPageSelector = {
  items: rawWalletMovementSelector,
  totalCount: true,
  totalPages: true,
  currentPage: true,
}

const _validatePage: MakeAllFieldsRequired<ValueTypes['PaginatedWalletMovementsPaginationResult']> = rawWalletMovementsPageSelector

export const walletMovementsPageSelector = Selector('PaginatedWalletMovementsPaginationResult')(rawWalletMovementsPageSelector)

export type walletMovementModel = ModelTypes['WalletMovement']

/** Неисполненная заявка или платёж пайщика: вид, состояние, сумма, реквизиты. */
export const rawWalletPendingItemSelector = {
  hash: true,
  type: true,
  title: true,
  state: true,
  quantity: true,
  payment_method_id: true,
  created_at: true,
}

const _validatePending: MakeAllFieldsRequired<ValueTypes['WalletPendingItem']> = rawWalletPendingItemSelector

export const walletPendingItemSelector = Selector('WalletPendingItem')(rawWalletPendingItemSelector)

export type walletPendingItemModel = ModelTypes['WalletPendingItem']
