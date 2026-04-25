/**
 * Заявка на поставку — связь с блокчейном
 * Создаётся при match двух карточек (offer+order)
 */
export enum SupplyOrderStatus {
  PENDING = 'pending',
  BLOCKCHAIN_SUBMITTED = 'blockchain_submitted',
  ACCEPTED = 'accepted',
  AUTHORIZED = 'authorized',
  SUPPLIED = 'supplied',
  DELIVERED = 'delivered',
  REQ_RETURN = 'reqreturn',
  RET_AUTHORIZED = 'retauthorized',
  RECEIVED = 'received',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
  DESTROYED = 'destroyed',
}

export interface SupplyOrderEntity {
  id: string;
  coopname: string;
  offer_card_id: string;
  order_card_id?: string;
  blockchain_hash?: string;
  status: SupplyOrderStatus;
  supplier_username: string;
  customer_username: string;
  supplier_braname: string;
  receiver_braname: string;
  units: number;
  unit_cost: string;
  total_cost: string;
  membership_fee: string;
  created_at: Date;
  updated_at: Date;
}
