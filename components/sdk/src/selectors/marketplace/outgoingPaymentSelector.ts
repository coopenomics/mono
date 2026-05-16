import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawOutgoingPaymentSelector = {
  id: true,
  coopname: true,
  apl_reception_id: true,
  payee_account: true,
  related_order_ids: true,
  amount: true,
  symbol: true,
  purpose: true,
  status: true,
  confirmed_at: true,
  payment_reference: true,
  bank_statement_ref: true,
  blocked_reason: true,
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

export const marketplaceOutgoingPaymentResultSelector = Selector(
  'MarketplaceOutgoingPaymentResult',
)({
  payment_request: rawOutgoingPaymentSelector,
})
