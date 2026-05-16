import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export interface MarketplaceOutgoingPaymentRequestView {
  id: string;
  coopname: string;
  apl_reception_id: string;
  payee_account: string;
  related_order_ids: string[];
  amount: string;
  symbol: string;
  purpose: string;
  status: string;
  confirmed_at: string | null;
  payment_reference: string | null;
  bank_statement_ref: string | null;
  blocked_reason: string | null;
  payout_tx_hash: string | null;
  core_payment_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function listMyPayments(): Promise<MarketplaceOutgoingPaymentRequestView[]> {
  const result = await client.Query(Queries.Marketplace.ListOutgoingPaymentsAsSupplier.query, {});
  return result[
    Queries.Marketplace.ListOutgoingPaymentsAsSupplier.name
  ] as unknown as MarketplaceOutgoingPaymentRequestView[];
}
