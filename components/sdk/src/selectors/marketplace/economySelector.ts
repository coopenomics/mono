import { Selector } from '../../zeus/index'

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
  amount: true,
})
