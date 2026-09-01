import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawOrderCreateTxSnapshotSelector = {
  tx_hash: true,
  block_num: true,
  locked_amount: true,
  signed_at: true,
}

const _validateTxSnapshot: MakeAllFieldsRequired<ValueTypes['MarketplaceOrderCreateTxSnapshot']> =
  rawOrderCreateTxSnapshotSelector

export const marketplaceOrderCreateTxSnapshotSelector = Selector('MarketplaceOrderCreateTxSnapshot')(
  rawOrderCreateTxSnapshotSelector,
)

const rawOrderIssuanceFactSnapshotSelector = {
  actual_quantity: true,
  fact_unit_price: true,
  fact_cost: true,
  diff_state: true,
}

const _validateIssuanceFact: MakeAllFieldsRequired<
  ValueTypes['MarketplaceOrderIssuanceFactSnapshot']
> = rawOrderIssuanceFactSnapshotSelector

export const marketplaceOrderIssuanceFactSnapshotSelector = Selector(
  'MarketplaceOrderIssuanceFactSnapshot',
)(rawOrderIssuanceFactSnapshotSelector)

export const rawOrderSelector = {
  id: true,
  coopname: true,
  order_hash: true,
  orderer_account: true,
  orderer_name: true,
  orderer_verification_passed: true,
  offer_id: true,
  offer_hash: true,
  product_name: true,
  image_url: true,
  unit_of_measure: true,
  supplier_account: true,
  supplier_name: true,
  delivery_braname: true,
  delivery_point_name: true,
  delivery_point_address: true,
  delivery_point_lat: true,
  delivery_point_lng: true,
  quantity: true,
  package_size: true,
  warehouse_quantity: true,
  warehouse_locations: true,
  warehouse_arrival_price: true,
  group_accumulated_quantity: true,
  group_min_volume: true,
  price_per_unit: true,
  total_cost: true,
  membership_fee: true,
  total_cost_with_fee: true,
  cycle_id: true,
  checkout_id: true,
  shipment_id: true,
  warranty_period_secs: true,
  warranty_until: true,
  status: true,
  last_status_reason: true,
  blocked_at: true,
  accepted_at: true,
  received_at: true,
  cancelled_at: true,
  create_tx: rawOrderCreateTxSnapshotSelector,
  current_warehouse_braname: true,
  issuance_fact: rawOrderIssuanceFactSnapshotSelector,
  is_ready_announced: true,
  chairman_signed_at: true,
  chairman_account: true,
  signiss1_tx_hash: true,
  orderer_signed_at: true,
  delivery_signer_account: true,
  signiss2_tx_hash: true,
  created_at: true,
  updated_at: true,
}

const _validateOrder: MakeAllFieldsRequired<ValueTypes['MarketplaceOrder']> = rawOrderSelector

export const marketplaceOrderSelector = Selector('MarketplaceOrder')(rawOrderSelector)

export const marketplaceCancelOrderResultSelector = Selector('MarketplaceCancelOrderResult')({
  order: rawOrderSelector,
  tx_hash: true,
})

export const marketplaceSupplierBatchActionResultSelector = Selector(
  'MarketplaceSupplierBatchActionResult',
)({
  cycle_id: true,
  orders: rawOrderSelector,
  tx_hashes: true,
})

export const marketplaceOrderPaginationResultSelector = Selector('MarketplaceOrderPaginationResult')({
  items: rawOrderSelector,
  totalCount: true,
  totalPages: true,
  currentPage: true,
})
