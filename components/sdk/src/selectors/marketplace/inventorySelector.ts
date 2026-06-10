import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawInventorySelector = {
  id: true,
  coopname: true,
  barcode_value: true,
  barcode_format: true,
  order_id: true,
  shipment_id: true,
  braname: true,
  status: true,
  product_name_snapshot: true,
  quantity_per_label: true,
  orderer_account_snapshot: true,
  orderer_name: true,
  unit_of_measure: true,
  delivery_point_name: true,
  delivery_point_address: true,
  shelf: true,
  received_at: true,
  expiry_date: true,
  received_by_operator_account: true,
  labeled_at: true,
  labeled_by_operator_account: true,
  created_at: true,
  ownership: true,
  arrival_price: true,
  published_offer_id: true,
  reserved_order_id: true,
  updated_at: true,
}

const _validateInventory: MakeAllFieldsRequired<ValueTypes['MarketplaceInventoryItem']> =
  rawInventorySelector

export const marketplaceInventoryItemSelector = Selector('MarketplaceInventoryItem')(
  rawInventorySelector,
)

export const marketplaceInventoryMutationResultSelector = Selector(
  'MarketplaceInventoryMutationResult',
)({
  inventory: rawInventorySelector,
})
