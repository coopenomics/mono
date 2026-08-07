import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawTTNDataSelector = {
  expeditor_full_name: true,
  expeditor_phone: true,
  vehicle_number: true,
  loading_address: true,
  loading_datetime: true,
  delivery_datetime_estimate: true,
  packaging: {
    order_id: true,
    units_per_box: true,
  },
}

const rawFactEntrySelector = {
  order_id: true,
  fact_quantity: true,
  fact_unit_price: true,
  product_name: true,
  unit_of_measure: true,
  package_size: true,
  // Заказчик по позиции: этикетку клеят на конкретную единицу конкретного
  // человека, а строка сверки агрегирует их всех в одну.
  orderer_account: true,
  orderer_name: true,
}

const _validateFactEntry: MakeAllFieldsRequired<ValueTypes['MarketplaceAplReceptionFactEntry']> =
  rawFactEntrySelector

const rawAplReceptionSelector = {
  id: true,
  coopname: true,
  shipment_id: true,
  cycle_id: true,
  braname: true,
  offerer_account: true,
  offerer_name: true,
  variant: true,
  status: true,
  fact_quantity_per_order: rawFactEntrySelector,
  ttn_number: true,
  expeditor_data: rawTTNDataSelector,
  created_by_operator_account: true,
  supplier_signed_at: true,
  supplier_signsupp_tx_hash: true,
  chairman_signed_at: true,
  chairman_account: true,
  chairman_signchair_tx_hash: true,
  total_amount: true,
  created_at: true,
  updated_at: true,
}

const _validateAplReception: MakeAllFieldsRequired<ValueTypes['MarketplaceAplReception']> =
  rawAplReceptionSelector

export const marketplaceAplReceptionSelector = Selector('MarketplaceAplReception')(
  rawAplReceptionSelector,
)

export const marketplaceAplReceptionResultSelector = Selector('MarketplaceAplReceptionResult')({
  apl_reception: rawAplReceptionSelector,
})

const rawExpressPickupCandidateSelector = {
  offerer_account: true,
  braname: true,
  orders_count: true,
  total_units: true,
  total_amount: true,
}

const _validateExpressCandidate: MakeAllFieldsRequired<
  ValueTypes['MarketplaceExpressPickupCandidate']
> = rawExpressPickupCandidateSelector

export const marketplaceExpressPickupCandidateSelector = Selector(
  'MarketplaceExpressPickupCandidate',
)(rawExpressPickupCandidateSelector)

export const marketplaceCreateExpressReceptionResultSelector = Selector(
  'MarketplaceCreateExpressReceptionResult',
)({
  apl_receptions: rawAplReceptionSelector,
})
