import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawDocumentAggregateSelector } from '../documents/documentAggregateSelector'

export const rawLoanSelector = {
  _id: true,
  _created_at: true,
  _updated_at: true,
  present: true,
  block_num: true,
  id: true,
  status: true,
  debt_hash: true,
  contract_number: true,
  coopname: true,
  username: true,
  collateral: true,
  source: true,
  source_ref: true,
  amount: true,
  remaining: true,
  pledged: true,
  created_at: true,
  issued_at: true,
  due_at: true,
  requested_due_at: true,
  overdue_at: true,
  last_pay_error: true,
  statement: rawDocumentAggregateSelector,
  contract: rawDocumentAggregateSelector,
  signed_contract: rawDocumentAggregateSelector,
  decision: rawDocumentAggregateSelector,
  extension_statement: rawDocumentAggregateSelector,
}

const _validate: MakeAllFieldsRequired<ValueTypes['DebtLoan']> = rawLoanSelector

export type loanModel = ModelTypes['DebtLoan']

export const loanSelector = Selector('DebtLoan')(rawLoanSelector)
