import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { paginationSelector } from '../../utils/paginationSelector'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

// Трансляция паевого взноса из Благороста в Цифровой Кошелёк: строка истории
const rawShareTransferSelector = {
  _id: true,
  username: true,
  display_name: true,
  amount: true,
  statement_hash: true,
  transaction_id: true,
  created_at: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CapitalShareTransfer']> = rawShareTransferSelector

export type shareTransferModel = ModelTypes['CapitalShareTransfer']
export const shareTransferSelector = Selector('CapitalShareTransfer')(rawShareTransferSelector)
export { rawShareTransferSelector }

// Остаток паевого взноса в Благоросте, доступный для трансляции
const rawShareTransferStateSelector = {
  username: true,
  blagorost_balance: true,
}

const _validateState: MakeAllFieldsRequired<ValueTypes['CapitalShareTransferState']> = rawShareTransferStateSelector

export type shareTransferStateModel = ModelTypes['CapitalShareTransferState']
export const shareTransferStateSelector = Selector('CapitalShareTransferState')(rawShareTransferStateSelector)
export { rawShareTransferStateSelector }

// История трансляций постранично
const rawShareTransfersPaginationSelector = { ...paginationSelector, items: rawShareTransferSelector }
const _validatePage: MakeAllFieldsRequired<ValueTypes['PaginatedCapitalShareTransfersPaginationResult']> = rawShareTransfersPaginationSelector
export type shareTransfersPaginationModel = ModelTypes['PaginatedCapitalShareTransfersPaginationResult']
export const shareTransfersPaginationSelector = Selector('PaginatedCapitalShareTransfersPaginationResult')(rawShareTransfersPaginationSelector)
