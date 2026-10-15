import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawExpenseItemSelector = {
  item_hash: true,
  mechanics: true,
  recipient_type: true,
  recipient: true,
  recipient_name: true,
  description: true,
  planned_amount: true,
  actual_amount: true,
  status: true,
}
const _validateItem: MakeAllFieldsRequired<ValueTypes['EduExpenseItem']> = rawExpenseItemSelector

const rawExpenseSelector = {
  expense_hash: true,
  creator: true,
  creator_name: true,
  status: true,
  items: rawExpenseItemSelector,
  total_planned: true,
  total_actual: true,
  created_at: true,
  updated_at: true,
}
const _validateExpense: MakeAllFieldsRequired<ValueTypes['EduExpense']> = rawExpenseSelector
export const eduExpenseSelector = Selector('EduExpense')(rawExpenseSelector)

export const eduExpensesPaginationResultSelector = Selector('PaginatedEduExpensesPaginationResult')({
  items: rawExpenseSelector,
  totalCount: true,
  totalPages: true,
  currentPage: true,
})
