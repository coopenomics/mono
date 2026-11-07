import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { paginationSelector } from '../../utils/paginationSelector'
import { Selector, type ValueTypes } from '../../zeus/index'

// Инвестиционный этап кооперативного участка (задачи 99D-30, 99D-31):
// договор участия, вложения инициаторов, заявления на имущество и участок.

export const rawMarketplaceInvestAgreementSelector = {
  number: true,
  signed_at: true,
}
const _validateInvestAgreement: MakeAllFieldsRequired<ValueTypes['MarketplaceInvestAgreement']> = rawMarketplaceInvestAgreementSelector
export const marketplaceInvestAgreementSelector = Selector('MarketplaceInvestAgreement')(rawMarketplaceInvestAgreementSelector)

export const rawMarketplaceInvestorSelector = {
  braname: true,
  username: true,
  active: true,
  money: true,
  property: true,
  used: true,
  returned: true,
  claimed: true,
  claimable: true,
  unused: true,
}
const _validateInvestor: MakeAllFieldsRequired<ValueTypes['MarketplaceInvestor']> = rawMarketplaceInvestorSelector
export const marketplaceInvestorSelector = Selector('MarketplaceInvestor')(rawMarketplaceInvestorSelector)

export const rawMarketplaceInvestPropertySelector = {
  hash: true,
  username: true,
  amount: true,
  description: true,
  status: true,
}
const _validateInvestProperty: MakeAllFieldsRequired<ValueTypes['MarketplaceInvestProperty']> = rawMarketplaceInvestPropertySelector

export const rawMarketplaceBranchInvestmentSelector = {
  braname: true,
  phase: true,
  money_total: true,
  property_total: true,
  unused_total: true,
  reserved: true,
  spent_total: true,
  repaid_total: true,
  outstanding: true,
  investors: rawMarketplaceInvestorSelector,
  properties: rawMarketplaceInvestPropertySelector,
}
const _validateBranchInvestment: MakeAllFieldsRequired<ValueTypes['MarketplaceBranchInvestment']> = rawMarketplaceBranchInvestmentSelector
export const marketplaceBranchInvestmentSelector = Selector('MarketplaceBranchInvestment')(rawMarketplaceBranchInvestmentSelector)

export const rawMarketplaceInvestHistoryEntrySelector = {
  kind: true,
  amount: true,
  process_hash: true,
  created_at: true,
  global_sequence: true,
}
const _validateInvestHistoryEntry: MakeAllFieldsRequired<ValueTypes['MarketplaceInvestHistoryEntry']> = rawMarketplaceInvestHistoryEntrySelector

export const rawMarketplaceInvestHistoryPaginationSelector = {
  ...paginationSelector,
  items: rawMarketplaceInvestHistoryEntrySelector,
}
const _validateInvestHistory: MakeAllFieldsRequired<ValueTypes['MarketplaceInvestHistoryPaginationResult']> = rawMarketplaceInvestHistoryPaginationSelector
export const marketplaceInvestHistoryPaginationSelector = Selector('MarketplaceInvestHistoryPaginationResult')(rawMarketplaceInvestHistoryPaginationSelector)
