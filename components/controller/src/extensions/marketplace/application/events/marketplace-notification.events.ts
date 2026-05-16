/**
 * Per-contract event-bus каналы marketplace для push-уведомлений (Эпик 5).
 * Эмитятся ПОСЛЕ commit'а в PG (INV-12) — listener доставляет уведомление
 * через Novu провайдер без обратного влияния на основной flow.
 */
export const MARKETPLACE_APL_SUPPLIER_SIGN_REQUEST_EVENT =
  'marketplace.aplReception.b.supplier.signRequested';

export const MARKETPLACE_CASHIER_NEW_PAYMENT_EVENT =
  'marketplace.outgoingPayment.cashier.newTask';

export const MARKETPLACE_SUPPLIER_PAYMENT_CONFIRMED_EVENT =
  'marketplace.outgoingPayment.supplier.confirmed';

export interface MarketplaceAplSupplierSignRequestEvent {
  coopname: string;
  apl_reception_id: string;
  supplier_account: string;
  ku_name: string;
  ttn_number: string;
  expeditor_name: string;
}

export interface MarketplaceCashierNewPaymentEvent {
  coopname: string;
  apl_reception_id: string;
  payment_request_id: string;
  supplier_account: string;
  amount: string;
}

export interface MarketplaceSupplierPaymentConfirmedEvent {
  coopname: string;
  apl_reception_id: string;
  payment_request_id: string;
  supplier_account: string;
  amount: string;
  payment_reference: string;
}
