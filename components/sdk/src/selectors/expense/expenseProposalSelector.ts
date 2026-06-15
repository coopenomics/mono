import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'
import { rawDocumentAggregateSelector } from '../documents/documentAggregateSelector'
import { rawExpenseItemSelector } from './expenseItemSelector'

export const rawExpenseProposalSelector = {
  _id: true,
  _created_at: true,
  _updated_at: true,
  proposal_hash: true,
  coopname: true,
  username: true,
  source_wallet: true,
  status: true,
  blockchain_status: true,
  total_planned: true,
  total_actual: true,
  created_at: true,
  updated_at: true,
  id: true,
  block_num: true,
  present: true,
  items: rawExpenseItemSelector,
  statement_doc: rawDocumentAggregateSelector,
  decision_doc: rawDocumentAggregateSelector,
}

const _validate: MakeAllFieldsRequired<ValueTypes['ExpenseProposal']> = rawExpenseProposalSelector

export const expenseProposalSelector = Selector('ExpenseProposal')(rawExpenseProposalSelector)
