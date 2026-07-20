import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawExpenseItemSelector = {
  item_hash: true,
  description: true,
  planned_amount: true,
  actual_amount: true,
  mechanics: true,
  recipient: true,
  recipient_type: true,
  status: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['ExpenseItem']> = rawExpenseItemSelector

export const expenseItemSelector = Selector('ExpenseItem')(rawExpenseItemSelector)
