import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { paginationSelector } from '../../utils/paginationSelector'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

// Коэффициент экономического участия (задача 99D-23): настройки модели,
// инициатор участка, резерв социально-экономического обеспечения пайщиков,
// итоги месяцев участка и текущий месяц.

export const rawMarketplaceAccumulationFundSelector = {
  name: true,
  percent: true,
  wallet_name: true,
}
const _validateAccumulationFund: MakeAllFieldsRequired<ValueTypes['MarketplaceAccumulationFund']> = rawMarketplaceAccumulationFundSelector

export const rawMarketplaceEconomySettingsSelector = {
  membership_fee_percent: true,
  initiator_share_percent: true,
  aid_month_limit: true,
  funds_percent: true,
  funds: rawMarketplaceAccumulationFundSelector,
}
const _validateEconomySettings: MakeAllFieldsRequired<ValueTypes['MarketplaceEconomySettings']> = rawMarketplaceEconomySettingsSelector
export const marketplaceEconomySettingsSelector = Selector('MarketplaceEconomySettings')(rawMarketplaceEconomySettingsSelector)

export const rawMarketplaceBranchInitiatorSelector = {
  braname: true,
  username: true,
  assigned: true,
  invest_balance: true,
}
const _validateBranchInitiator: MakeAllFieldsRequired<ValueTypes['MarketplaceBranchInitiator']> = rawMarketplaceBranchInitiatorSelector
export const marketplaceBranchInitiatorSelector = Selector('MarketplaceBranchInitiator')(rawMarketplaceBranchInitiatorSelector)

export const rawMarketplaceBranchReserveSelector = {
  username: true,
  amount: true,
  submitted: true,
  remaining: true,
}
const _validateBranchReserve: MakeAllFieldsRequired<ValueTypes['MarketplaceBranchReserve']> = rawMarketplaceBranchReserveSelector

export const rawMarketplaceBranchReservesSelector = {
  braname: true,
  limit: true,
  rows: rawMarketplaceBranchReserveSelector,
}
const _validateBranchReserves: MakeAllFieldsRequired<ValueTypes['MarketplaceBranchReserves']> = rawMarketplaceBranchReservesSelector
export const marketplaceBranchReservesSelector = Selector('MarketplaceBranchReserves')(rawMarketplaceBranchReservesSelector)

export const rawMarketplaceBranchPeriodSelector = {
  braname: true,
  period: true,
  starts_at: true,
  ends_at: true,
  turnover: true,
  secured: true,
  planned: true,
  memos: true,
  aid_paid: true,
  aid_reserve: true,
  aid_unpaid: true,
  expenses: true,
  membership: true,
  funds_amount: true,
  branch_amount: true,
  initiator_amount: true,
  return_amount: true,
  deficit: true,
  rate_percent: true,
  initiator: true,
  invest_phase: true,
  investor_repaid: true,
  rows_total: true,
  rows_charged: true,
  closed_at: true,
  archived: true,
}
const _validateBranchPeriod: MakeAllFieldsRequired<ValueTypes['MarketplaceBranchPeriod']> = rawMarketplaceBranchPeriodSelector

export const rawMarketplaceBranchPeriodsPaginationSelector = {
  ...paginationSelector,
  items: rawMarketplaceBranchPeriodSelector,
}
const _validateBranchPeriods: MakeAllFieldsRequired<ValueTypes['MarketplaceBranchPeriodsPaginationResult']> = rawMarketplaceBranchPeriodsPaginationSelector
export type marketplaceBranchPeriodsPaginationModel = ModelTypes['MarketplaceBranchPeriodsPaginationResult']
export const marketplaceBranchPeriodsPaginationSelector = Selector('MarketplaceBranchPeriodsPaginationResult')(rawMarketplaceBranchPeriodsPaginationSelector)

export const rawMarketplaceBranchCurrentPeriodSelector = {
  braname: true,
  period: true,
  starts_at: true,
  ends_at: true,
  planned: true,
  memos: true,
  aid_paid: true,
  aid_reserve: true,
  expenses: true,
  ripening_orders: true,
  ripening_turnover: true,
  ripening_secured: true,
  distributed: true,
  received: true,
}
const _validateBranchCurrentPeriod: MakeAllFieldsRequired<ValueTypes['MarketplaceBranchCurrentPeriod']> = rawMarketplaceBranchCurrentPeriodSelector
export const marketplaceBranchCurrentPeriodSelector = Selector('MarketplaceBranchCurrentPeriod')(rawMarketplaceBranchCurrentPeriodSelector)
