import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawReturnRequestSelector = {
  id: true,
  member_username: true,
  amount: true,
  status: true,
  statement_hash: true,
  decline_reason: true,
  created_at: true,
  decided_at: true,
}
const _validateReturnRequest: MakeAllFieldsRequired<ValueTypes['EduReturnRequest']> = rawReturnRequestSelector
export const eduReturnRequestSelector = Selector('EduReturnRequest')(rawReturnRequestSelector)

const rawReturnBalanceSelector = { available: true, pending: true, free: true }
const _validateReturnBalance: MakeAllFieldsRequired<ValueTypes['EduReturnBalance']> = rawReturnBalanceSelector
export const eduReturnBalanceSelector = Selector('EduReturnBalance')(rawReturnBalanceSelector)
