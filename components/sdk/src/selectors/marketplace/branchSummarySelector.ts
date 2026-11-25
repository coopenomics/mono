import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { paginationSelector } from '../../utils/paginationSelector'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { rawWorkingHoursSelector } from './kuDetailsSelector'

// Сводка участка для пайщика: вкладка «Стол заказов» на странице кооперативного участка.
const rawMarketplaceBranchSummarySelector = {
  braname: true,
  issuance_point: {
    working_hours: rawWorkingHoursSelector,
    active: true,
  },
  common_balance: true,
  social_fund_balance: true,
  initiators: {
    money_total: true,
    property_total: true,
    repaid_total: true,
    outstanding: true,
  },
}
// Проверка валидности
const _validateBranchSummary: MakeAllFieldsRequired<ValueTypes['MarketplaceBranchSummary']> = rawMarketplaceBranchSummarySelector

export type marketplaceBranchSummaryModel = ModelTypes['MarketplaceBranchSummary']
export const marketplaceBranchSummarySelector = Selector('MarketplaceBranchSummary')(rawMarketplaceBranchSummarySelector)

const rawMarketplaceBranchSummaryMovementSelector = {
  global_sequence: true,
  operation_code: true,
  quantity: true,
  created_at: true,
}

const rawMarketplaceBranchSummaryMovementsPaginationSelector = {
  ...paginationSelector,
  items: rawMarketplaceBranchSummaryMovementSelector,
}
// Проверка валидности
const _validateBranchSummaryMovements: MakeAllFieldsRequired<ValueTypes['MarketplaceBranchSummaryMovementsPaginationResult']> =
  rawMarketplaceBranchSummaryMovementsPaginationSelector

export type marketplaceBranchSummaryMovementsPaginationModel = ModelTypes['MarketplaceBranchSummaryMovementsPaginationResult']
export const marketplaceBranchSummaryMovementsPaginationSelector = Selector('MarketplaceBranchSummaryMovementsPaginationResult')(
  rawMarketplaceBranchSummaryMovementsPaginationSelector
)
