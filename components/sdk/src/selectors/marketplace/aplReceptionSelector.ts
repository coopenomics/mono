import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawTTNDataSelector = {
  expeditor_full_name: true,
  expeditor_id_doc: true,
  expeditor_phone: true,
  vehicle_number: true,
  loading_address: true,
  loading_datetime: true,
  delivery_datetime_estimate: true,
}

const rawFactEntrySelector = {
  order_id: true,
  fact_quantity: true,
}

const _validateFactEntry: MakeAllFieldsRequired<ValueTypes['MarketplaceAplReceptionFactEntry']> =
  rawFactEntrySelector

const rawAplReceptionSelector = {
  id: true,
  coopname: true,
  shipment_id: true,
  cycle_id: true,
  ku_id: true,
  offerer_account: true,
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

const rawSignablePayloadSelector = {
  order_id: true,
  order_hash: true,
  version: true,
  meta: true,
  meta_hash: true,
  doc_hash: true,
  hash: true,
}

const _validatePayload: MakeAllFieldsRequired<ValueTypes['MarketplaceAplReceptionSignablePayload']> =
  rawSignablePayloadSelector

export const marketplaceAplReceptionSignablePayloadSelector = Selector(
  'MarketplaceAplReceptionSignablePayload',
)(rawSignablePayloadSelector)
