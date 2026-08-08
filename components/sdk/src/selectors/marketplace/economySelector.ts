import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { paginationSelector } from '../../utils/paginationSelector'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'

export const marketplaceEconomyConfigSelector = Selector('MarketplaceEconomyConfig')({
  membership_fee_percent: true,
})

export const marketplaceTrusteeWeightSelector = Selector('MarketplaceTrusteeWeight')({
  username: true,
  weight: true,
  share_percent: true,
  personal_balance: true,
})

export const marketplaceBranchEconomySelector = Selector('MarketplaceBranchEconomy')({
  braname: true,
  total_weight: true,
  weights: marketplaceTrusteeWeightSelector,
  common_balance: true,
  reserve_amount: true,
  available_to_distribute: true,
})

export const marketplacePersonalEconomySelector = Selector('MarketplacePersonalEconomy')({
  personal_balance: true,
})

export const marketplaceAidSelector = Selector('MarketplaceAid')({
  hash: true,
  username: true,
  braname: true,
  amount: true,
  stage: true,
  payment_status: true,
  payment_destination: true,
})

export const rawMarketplaceBranchWalletOperationSelector = {
  global_sequence: true,
  operation_code: true,
  quantity: true,
  memo: true,
  order_hash: true,
  order_id: true,
  created_at: true,
}
export const marketplaceBranchWalletOperationSelector = Selector('MarketplaceBranchWalletOperation')(
  rawMarketplaceBranchWalletOperationSelector
)

export const rawMarketplaceBranchWalletHistoryPaginationSelector = {
  ...paginationSelector,
  items: rawMarketplaceBranchWalletOperationSelector,
}
// Проверка валидности
const _validateBranchWalletHistory: MakeAllFieldsRequired<ValueTypes['MarketplaceBranchWalletHistoryPaginationResult']> =
  rawMarketplaceBranchWalletHistoryPaginationSelector

export type marketplaceBranchWalletHistoryPaginationModel = ModelTypes['MarketplaceBranchWalletHistoryPaginationResult']
export const marketplaceBranchWalletHistoryPaginationSelector = Selector('MarketplaceBranchWalletHistoryPaginationResult')(
  rawMarketplaceBranchWalletHistoryPaginationSelector
)
