import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'
import { marketplaceOfferSelector } from './offerSelector'

export const rawMarketplaceOfferPaginationSelector = {
  items: marketplaceOfferSelector,
  totalCount: true,
  totalPages: true,
  currentPage: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['MarketplaceOfferPaginationResult']> =
  rawMarketplaceOfferPaginationSelector

export const marketplaceOfferPaginationSelector = Selector('MarketplaceOfferPaginationResult')(
  rawMarketplaceOfferPaginationSelector,
)
