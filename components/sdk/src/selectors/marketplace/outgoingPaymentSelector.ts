import { Selector, type ValueTypes } from '../../zeus/index'
import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'

const rawOutgoingPaymentSelector = {
  id: true,
  coopname: true,
  order_hash: true,
  order_id: true,
  apl_reception_id: true,
  payee_account: true,
  amount: true,
  symbol: true,
  purpose: true,
  payout_destination: true,
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
