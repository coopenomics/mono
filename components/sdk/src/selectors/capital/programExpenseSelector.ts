import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { documentAggregateSelector } from '../documents'
import { baseCapitalSelector } from './baseCapitalSelector'

const rawProgramExpenseSelector = {
  ...baseCapitalSelector,
  id: true,
  status: true,
  expense_hash: true,
  coopname: true,
  username: true,
  fund_id: true,
  blockchain_status: true,
  amount: true,
  description: true,
  spended_at: true,
  expense_statement: documentAggregateSelector,
  approved_statement: documentAggregateSelector,
  authorization: documentAggregateSelector,
}

const _validate: MakeAllFieldsRequired<ValueTypes['CapitalProgramExpense']> = rawProgramExpenseSelector

export type programExpenseModel = ModelTypes['CapitalProgramExpense']

export const programExpenseSelector = Selector('CapitalProgramExpense')(rawProgramExpenseSelector)
export { rawProgramExpenseSelector }
