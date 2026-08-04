import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { paginationSelector } from '../../utils/paginationSelector'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawExpenseProposalSelector } from './expenseProposalSelector'

export const rawExpenseProposalsPaginationSelector = {
  ...paginationSelector,
  items: rawExpenseProposalSelector,
}

const _validate: MakeAllFieldsRequired<ValueTypes['PaginatedExpenseProposalsPaginationResult']>
  = rawExpenseProposalsPaginationSelector

export type expenseProposalsPaginationModel = ModelTypes['PaginatedExpenseProposalsPaginationResult']

export const expenseProposalsPaginationSelector = Selector('PaginatedExpenseProposalsPaginationResult')(
  rawExpenseProposalsPaginationSelector,
)
