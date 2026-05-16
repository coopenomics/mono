import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { MarketplaceOutgoingPaymentRequestView } from '../../OffererPaymentHistory/api';

export type { MarketplaceOutgoingPaymentRequestView } from '../../OffererPaymentHistory/api';

export async function listOutgoingPaymentsForCashier(
  statuses?: Array<'PENDING_CASHIER_ACTION' | 'CONFIRMED_BY_CASHIER' | 'LEDGER_RECORDED' | 'BLOCKED'>,
): Promise<MarketplaceOutgoingPaymentRequestView[]> {
  const result = await client.Query(Queries.Marketplace.ListOutgoingPaymentsForCashier.query, {
    variables: { statuses },
  });
  return result[
    Queries.Marketplace.ListOutgoingPaymentsForCashier.name
  ] as unknown as MarketplaceOutgoingPaymentRequestView[];
}

export async function confirmOutgoingPayment(input: {
  payment_request_id: string;
  payment_reference: string;
  bank_statement_ref?: string;
}): Promise<{ payment_request: MarketplaceOutgoingPaymentRequestView }> {
  const result = await client.Mutation(Mutations.Marketplace.ConfirmOutgoingPayment.mutation, {
    variables: { input },
  });
  return result[Mutations.Marketplace.ConfirmOutgoingPayment.name] as unknown as {
    payment_request: MarketplaceOutgoingPaymentRequestView;
  };
}

export async function blockOutgoingPayment(input: {
  payment_request_id: string;
  reason: string;
}): Promise<{ payment_request: MarketplaceOutgoingPaymentRequestView }> {
  const result = await client.Mutation(Mutations.Marketplace.BlockOutgoingPayment.mutation, {
    variables: { input },
  });
  return result[Mutations.Marketplace.BlockOutgoingPayment.name] as unknown as {
    payment_request: MarketplaceOutgoingPaymentRequestView;
  };
}
