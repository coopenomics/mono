import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

const rawProgramExpenseItemSelector = {
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

const _validateItem: MakeAllFieldsRequired<ValueTypes['CapitalProgramExpenseItem']> = rawProgramExpenseItemSelector

export const programExpenseItemSelector = Selector('CapitalProgramExpenseItem')(rawProgramExpenseItemSelector)

const rawProgramExpenseCallbackSelector = {
  contract: true,
  action: true,
  data: true,
}

const _validateCallback: MakeAllFieldsRequired<ValueTypes['CapitalProgramExpenseCallback']> = rawProgramExpenseCallbackSelector

export const programExpenseCallbackSelector = Selector('CapitalProgramExpenseCallback')(rawProgramExpenseCallbackSelector)

const rawProgramExpenseSelector = {
  coopname: true,
  expense_hash: true,
  creator: true,
  creator_name: true,
  source_wallet: true,
  status: true,
  callback: rawProgramExpenseCallbackSelector,
  items: rawProgramExpenseItemSelector,
  total_planned: true,
  total_actual: true,
  created_at: true,
  updated_at: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CapitalProgramExpense']> = rawProgramExpenseSelector

export type programExpenseModel = ModelTypes['CapitalProgramExpense']

export const programExpenseSelector = Selector('CapitalProgramExpense')(rawProgramExpenseSelector)
export { rawProgramExpenseSelector }
