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
  package_id: true,
  warehouse_quantity: true,
  warehouse_locations: true,
  warehouse_arrival_price: true,
  group_accumulated_quantity: true,
  group_min_volume: true,
  price_per_unit: true,
  total_cost: true,
  membership_fee: true,
  accepted_cost: true,
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
  issue_statement_at: true,
  issue_decision_id: true,
  delivery_signer_account: true,
  issue_closed_tx_hash: true,
  created_at: true,
  updated_at: true,
}

// `secure_part` в общий селектор не входит: его просит только карточка одного
// заказа (`orderDetailSelector`), в лентах каждая строка стоила бы чтения учёта.
const _validateOrder: MakeAllFieldsRequired<Omit<ValueTypes['MarketplaceOrder'], 'secure_part'>> = rawOrderSelector

export const marketplaceOrderSelector = Selector('MarketplaceOrder')(rawOrderSelector)

/** Обеспечительная часть паевого взноса по заказу (99D-18). */
export const rawSecurePartSelector = {
  state: true,
  amount: true,
  due_amount: true,
  charged_amount: true,
  returned_amount: true,
  charge_at: true,
  settled_at: true,
}

const _validateSecurePart: MakeAllFieldsRequired<ValueTypes['MarketplaceSecurePart']> = rawSecurePartSelector

/** Карточка одного заказа: всё из ленты и обеспечительная часть. */
export const marketplaceOrderDetailSelector = Selector('MarketplaceOrder')({
  ...rawOrderSelector,
  secure_part: rawSecurePartSelector,
})

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
