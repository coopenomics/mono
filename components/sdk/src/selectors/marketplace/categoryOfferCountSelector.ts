import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

const rawCategoryOfferCountSelector = {
  category_id: true,
  count: true,
}

const _validate: MakeAllFieldsRequired<ValueTypes['MarketplaceCategoryOfferCount']> =
  rawCategoryOfferCountSelector

export const marketplaceCategoryOfferCountSelector = Selector('MarketplaceCategoryOfferCount')(
  rawCategoryOfferCountSelector,
)
