import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const rawLedger2OperationSelector = {
  globalSequence: true,
  blockNum: true,
  coopname: true,
  action: true,
  operationCode: true,
  processHash: true,
  username: true,
  accountId: true,
  walletFrom: true,
  walletTo: true,
  quantity: true,
  memo: true,
  parentApplyGlobalSequence: true,
  createdAt: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['Ledger2Operation']> = rawLedger2OperationSelector

export type ledger2OperationModel = ModelTypes['Ledger2Operation']
export const ledger2OperationSelector = Selector('Ledger2Operation')(rawLedger2OperationSelector)

export const rawLedger2HistoryResponseSelector = {
  items: rawLedger2OperationSelector,
  totalCount: true,
  totalPages: true,
  currentPage: true,
}

const _validateResp: MakeAllFieldsRequired<ValueTypes['Ledger2HistoryResponse']> = rawLedger2HistoryResponseSelector

export type ledger2HistoryResponseModel = ModelTypes['Ledger2HistoryResponse']
export const ledger2HistoryResponseSelector = Selector('Ledger2HistoryResponse')(rawLedger2HistoryResponseSelector)
