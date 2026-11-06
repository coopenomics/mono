import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'

/** Профиль поставщика: имя, рассказ о себе, обложка, число предложений и сводная оценка. */
const rawSupplierProfileSelector = {
  supplier_account: true,
  display_name: true,
  custom_display_name: true,
  about: true,
  cover_url: true,
  is_cooperative: true,
  offers_count: true,
  rating_avg: true,
  reviews_count: true,
  updated_at: true,
}

const _validateSupplierProfile: MakeAllFieldsRequired<ValueTypes['MarketplaceSupplierProfile']> =
  rawSupplierProfileSelector

export const marketplaceSupplierProfileSelector = Selector('MarketplaceSupplierProfile')(
  rawSupplierProfileSelector,
)
