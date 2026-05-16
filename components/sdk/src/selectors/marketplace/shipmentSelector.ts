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

const _validateTTNData: MakeAllFieldsRequired<ValueTypes['MarketplaceShipmentTTNData']> =
  rawTTNDataSelector

const rawShipmentSelector = {
  id: true,
  coopname: true,
  cycle_id: true,
  ku_id: true,
  offerer_account: true,
  delivery_variant: true,
  status: true,
  total_amount: true,
  ttn_number: true,
  ttn_data: rawTTNDataSelector,
  ttn_document_registry_id: true,
  ttn_pdf_url: true,
  created_at: true,
  updated_at: true,
}

const _validateShipment: MakeAllFieldsRequired<ValueTypes['MarketplaceShipment']> =
  rawShipmentSelector

export const marketplaceShipmentSelector = Selector('MarketplaceShipment')(rawShipmentSelector)

export const marketplaceCreateShipmentResultSelector = Selector('MarketplaceCreateShipmentResult')({
  shipments: rawShipmentSelector,
})
