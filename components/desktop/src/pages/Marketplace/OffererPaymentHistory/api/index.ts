import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceOutgoingPaymentRequestView =
  Queries.Marketplace.ListOutgoingPaymentsAsSupplier.IOutput['marketplaceListOutgoingPaymentsAsSupplier'][number];

export async function listMyPayments(): Promise<MarketplaceOutgoingPaymentRequestView[]> {
  const { [Queries.Marketplace.ListOutgoingPaymentsAsSupplier.name]: result } = await client.Query(
    Queries.Marketplace.ListOutgoingPaymentsAsSupplier.query,
    {},
  );
  return result;
}
