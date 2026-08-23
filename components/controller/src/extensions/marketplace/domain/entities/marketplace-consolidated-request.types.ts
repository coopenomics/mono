export type MarketplaceConsolidatedRequestStatus =
  | 'PENDING_SUPPLIER_ACCEPT'
  | 'ACCEPTED'
  | 'DECLINED_BY_SUPPLIER'
  | 'EXPIRED_NO_RESPONSE';

export const MarketplaceConsolidatedRequestStatuses = {
  PENDING_SUPPLIER_ACCEPT: 'PENDING_SUPPLIER_ACCEPT',
  ACCEPTED: 'ACCEPTED',
  DECLINED_BY_SUPPLIER: 'DECLINED_BY_SUPPLIER',
  EXPIRED_NO_RESPONSE: 'EXPIRED_NO_RESPONSE',
} as const satisfies Record<string, MarketplaceConsolidatedRequestStatus>;

export interface MarketplaceConsolidatedRequestProps {
  id: string;
  coopname: string;
  offer_id: string;
  supplier_account: string;
  total_quantity: number;
  total_amount: string;
  status: MarketplaceConsolidatedRequestStatus;
  cycle_started_at: Date;
  cycle_ended_at: Date | null;
  expires_at: Date | null;
  accepted_at: Date | null;
  declined_at: Date | null;
  decline_reason: string | null;
  triggered_by_supplier_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
