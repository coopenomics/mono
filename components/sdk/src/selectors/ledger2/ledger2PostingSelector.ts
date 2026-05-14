import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const rawLedger2PostingSelector = {
  key: true,
  blockNum: true,
  processHash: true,
  operationCode: true,
  parentApplyGlobalSequence: true,
  debitGlobalSequence: true,
  debitAccountId: true,
  creditGlobalSequence: true,
  creditAccountId: true,
  quantity: true,
  memo: true,
  username: true,
  createdAt: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['Ledger2Posting']> = rawLedger2PostingSelector

export type ledger2PostingModel = ModelTypes['Ledger2Posting']
export const ledger2PostingSelector = Selector('Ledger2Posting')(rawLedger2PostingSelector)

export const rawLedger2PostingsResponseSelector = {
  items: rawLedger2PostingSelector,
  totalCount: true,
  totalPages: true,
  currentPage: true,
}

const _validateResp: MakeAllFieldsRequired<ValueTypes['Ledger2PostingsResponse']> = rawLedger2PostingsResponseSelector

export type ledger2PostingsResponseModel = ModelTypes['Ledger2PostingsResponse']
export const ledger2PostingsResponseSelector = Selector('Ledger2PostingsResponse')(rawLedger2PostingsResponseSelector)
