import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceOutgoingPaymentView =
  Queries.Marketplace.ListOutgoingPayments.IOutput['marketplaceListOutgoingPayments'][number];

export type IListOutgoingPaymentsInput = Queries.Marketplace.ListOutgoingPayments.IInput;

export type MarketplaceOutgoingPaymentDetailView = NonNullable<
  Queries.Marketplace.GetOutgoingPayment.IOutput['marketplaceGetOutgoingPayment']
>;

export async function listOutgoingPayments(
  input?: IListOutgoingPaymentsInput,
): Promise<MarketplaceOutgoingPaymentView[]> {
  const { [Queries.Marketplace.ListOutgoingPayments.name]: result } = await client.Query(
    Queries.Marketplace.ListOutgoingPayments.query,
    { variables: input ?? {} },
  );
  return result;
}

/**
 * Разворот выплаты: сама выплата, оплаченный заказ и запись в реестре кассира.
 * Собирается на бэкенде одним запросом — совету не приходится составлять
 * картину из трёх обращений.
 */
export async function getOutgoingPayment(
  id: string,
): Promise<MarketplaceOutgoingPaymentDetailView | null> {
  const { [Queries.Marketplace.GetOutgoingPayment.name]: result } = await client.Query(
    Queries.Marketplace.GetOutgoingPayment.query,
    { variables: { id } },
  );
  return result ?? null;
}
