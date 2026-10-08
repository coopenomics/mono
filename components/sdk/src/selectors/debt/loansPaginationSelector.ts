import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { paginationSelector } from '../../utils/paginationSelector'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawLoanSelector } from './loanSelector'

export const rawLoansPaginationSelector = {
  ...paginationSelector,
  items: rawLoanSelector,
}

const _validate: MakeAllFieldsRequired<ValueTypes['PaginatedDebtLoansPaginationResult']> = rawLoansPaginationSelector

export type loansPaginationModel = ModelTypes['PaginatedDebtLoansPaginationResult']

export const loansPaginationSelector = Selector('PaginatedDebtLoansPaginationResult')(rawLoansPaginationSelector)
