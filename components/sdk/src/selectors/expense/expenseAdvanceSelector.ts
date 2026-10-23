import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { paginationSelector } from '../../utils/paginationSelector'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const rawExpenseAdvanceSelector = {
  proposal_hash: true,
  item_hash: true,
  recipient: true,
  recipient_name: true,
  description: true,
  advance_amount: true,
  spent_amount: true,
  state: true,
  issued_at: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['ExpenseAdvance']> = rawExpenseAdvanceSelector

export const expenseAdvanceSelector = Selector('ExpenseAdvance')(rawExpenseAdvanceSelector)

export const rawExpenseAdvancesPaginationSelector = {
  ...paginationSelector,
  items: rawExpenseAdvanceSelector,
}

const _validatePage: MakeAllFieldsRequired<ValueTypes['PaginatedExpenseAdvancesPaginationResult']>
  = rawExpenseAdvancesPaginationSelector

export type expenseAdvancesPaginationModel = ModelTypes['PaginatedExpenseAdvancesPaginationResult']

export const expenseAdvancesPaginationSelector = Selector('PaginatedExpenseAdvancesPaginationResult')(
  rawExpenseAdvancesPaginationSelector,
)
