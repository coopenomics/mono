import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawOutgoingPaymentSelector = {
  id: true,
  coopname: true,
  payment_hash: true,
  orders_count: true,
  order_ids: true,
  payee_account: true,
  payee_name: true,
  amount: true,
  symbol: true,
  purpose: true,
  payout_destination: true,
  withheld_amount: true,
  status: true,
  completed_at: true,
  decline_reason: true,
  payout_tx_hash: true,
  core_payment_id: true,
  created_at: true,
  updated_at: true,
}

const _validateOutgoingPayment: MakeAllFieldsRequired<
  ValueTypes['MarketplaceOutgoingPaymentRequest']
> = rawOutgoingPaymentSelector

export const marketplaceOutgoingPaymentRequestSelector = Selector(
  'MarketplaceOutgoingPaymentRequest',
)(rawOutgoingPaymentSelector)

const rawOutgoingPaymentOrderSummarySelector = {
  id: true,
  product_name: true,
  quantity: true,
  unit_of_measure: true,
  price_per_unit: true,
  total_cost: true,
  accepted_cost: true,
  status: true,
  orderer_name: true,
  delivery_point_name: true,
}

const _validateOutgoingPaymentOrderSummary: MakeAllFieldsRequired<
  ValueTypes['MarketplaceOutgoingPaymentOrderSummary']
> = rawOutgoingPaymentOrderSummarySelector

const rawOutgoingPaymentCoreRecordSelector = {
  id: true,
  status: true,
  quantity: true,
  symbol: true,
  memo: true,
  message: true,
  created_at: true,
  completed_at: true,
}

const _validateOutgoingPaymentCoreRecord: MakeAllFieldsRequired<
  ValueTypes['MarketplaceOutgoingPaymentCoreRecord']
> = rawOutgoingPaymentCoreRecordSelector

export const marketplaceOutgoingPaymentDetailSelector = Selector(
  'MarketplaceOutgoingPaymentDetail',
)({
  payment: rawOutgoingPaymentSelector,
  orders: rawOutgoingPaymentOrderSummarySelector,
  core_payment: rawOutgoingPaymentCoreRecordSelector,
})
