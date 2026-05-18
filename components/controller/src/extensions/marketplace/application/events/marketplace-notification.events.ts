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

export const MARKETPLACE_SUPPLIER_PAYMENT_DECLINED_EVENT =
  'marketplace.outgoingPayment.supplier.declined';

/**
 * Story 6.4 / FR22: пайщику-заказчику отправляется multi-channel
 * уведомление, что его заказ готов на ПВЗ к получению. Эмитится после
 * успешной первой подписи АПП-выдачи председателем КУ (`signiss1`).
 */
export const MARKETPLACE_ORDER_READY_TO_RECEIVE_EVENT =
  'marketplace.order.orderer.readyToReceive';

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

export interface MarketplaceSupplierPaymentDeclinedEvent {
  coopname: string;
  apl_reception_id: string;
  payment_request_id: string;
  supplier_account: string;
  amount: string;
  reason: string;
}

export interface MarketplaceOrderReadyToReceiveEvent {
  coopname: string;
  order_id: string;
  order_hash: string;
  orderer_account: string;
  /** Кооперативный участок, где имущество готово к выдаче. */
  braname: string;
}

/**
 * Story 7.1 (Эпик 7): пайщик подал заявление на гарантийный возврат —
 * председатель КУ доставки заказа получает multi-channel уведомление на
 * рассмотрение.
 */
export const MARKETPLACE_RETURN_CLAIM_SUBMITTED_EVENT =
  'marketplace.returnClaim.chairman.submitted';

/**
 * Story 7.2 / 7.3 (Эпик 7): председатель принял промежуточное решение
 * (одобрить очный визит / отказать удалённо / принять / отказать на
 * месте) — заказчик получает уведомление о текущем состоянии заявления.
 */
export const MARKETPLACE_RETURN_CLAIM_DECIDED_EVENT =
  'marketplace.returnClaim.orderer.decided';

/**
 * Story 7.4 (Эпик 7): заявление достигло финального статуса
 * (ACCEPTED_AT_VISIT / REJECTED_REMOTELY / REJECTED_AT_VISIT) — отдельное
 * событие для финализации orderer-стола и обновления карточки Order'а.
 */
export const MARKETPLACE_RETURN_CLAIM_FINALIZED_EVENT =
  'marketplace.returnClaim.orderer.finalized';

export interface MarketplaceReturnClaimSubmittedEvent {
  coopname: string;
  claim_id: string;
  order_id: string;
  orderer_account: string;
  delivery_braname: string;
  reason_text: string;
}

export interface MarketplaceReturnClaimDecidedEvent {
  coopname: string;
  claim_id: string;
  orderer_account: string;
  stage: 'remote' | 'on_site';
  decision: 'approve_visit' | 'reject_remote' | 'accept_at_visit' | 'reject_at_visit';
  comment: string;
  braname: string;
}

export interface MarketplaceReturnClaimFinalizedEvent {
  coopname: string;
  claim_id: string;
  orderer_account: string;
  /** Финальный статус заявления (значение из `MarketplaceReturnClaimStatuses`). */
  final_status: string;
  /** Действие, приведшее к финальному состоянию (approve_visit здесь не появляется). */
  decision: 'approve_visit' | 'reject_remote' | 'accept_at_visit' | 'reject_at_visit';
  comment: string;
  ledger_snapshot: {
    amount: string;
    returned_quantity: number;
    tx_hash: string;
  } | null;
}
