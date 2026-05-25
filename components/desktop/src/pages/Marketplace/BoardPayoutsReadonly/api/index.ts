import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceOutgoingPaymentView =
  Queries.Marketplace.ListOutgoingPayments.IOutput['marketplaceListOutgoingPayments'][number];

export type IListOutgoingPaymentsInput = Queries.Marketplace.ListOutgoingPayments.IInput;

export async function listOutgoingPayments(
  input?: IListOutgoingPaymentsInput,
): Promise<MarketplaceOutgoingPaymentView[]> {
  const { [Queries.Marketplace.ListOutgoingPayments.name]: result } = await client.Query(
    Queries.Marketplace.ListOutgoingPayments.query,
    { variables: input ?? {} },
  );
  return result;
}
