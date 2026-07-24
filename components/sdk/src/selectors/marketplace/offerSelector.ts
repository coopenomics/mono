import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawOfferSelector = {
  id: true,
  coopname: true,
  supplier_account: true,
  vitrine_id: true,
  product_name: true,
  description: true,
  category_id: true,
  price_per_unit: true,
  unit_of_measure: true,
  order_unit_size: true,
  quantity_available: true,
  quantity_blocked: true,
  quantity_consumed: true,
  unlimited_flag: true,
  supplier_name: true,
  delivery_points: {
    braname: true,
    min_supply_volume: true,
    name: true,
    address: true,
    lat: true,
    lng: true,
  },
  shelf_life_days: true,
  warranty_days: true,
  barcode_strategy: true,
  pack_size: true,
  stock_braname: true,
  status: true,
  approved_by: true,
  approved_at: true,
  rejected_by: true,
  rejected_at: true,
  reject_reason: true,
  created_at: true,
  updated_at: true,
  images: {
    url: true,
    bucket_key: true,
    mime_type: true,
    sort_order: true,
    is_cover: true,
  },
}

const _validateOffer: MakeAllFieldsRequired<ValueTypes['MarketplaceOffer']> = rawOfferSelector

export const marketplaceOfferSelector = Selector('MarketplaceOffer')(rawOfferSelector)

const rawCategorySelector = {
  id: true,
  display_name: true,
  sort_order: true,
  mvp_baseline: true,
}

const _validateCategory: MakeAllFieldsRequired<ValueTypes['MarketplaceCategory']> = rawCategorySelector

export const marketplaceCategorySelector = Selector('MarketplaceCategory')(rawCategorySelector)
