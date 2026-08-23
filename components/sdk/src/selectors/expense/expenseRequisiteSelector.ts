import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

export const rawExpenseRequisiteSelector = {
  coopname: true,
  proposal_hash: true,
  item_hash: true,
  recipient: true,
  method_type: true,
  data: true,
  requisites: true,
  payment_purpose: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['ExpenseRequisite']> = rawExpenseRequisiteSelector

export const expenseRequisiteSelector = Selector('ExpenseRequisite')(rawExpenseRequisiteSelector)
