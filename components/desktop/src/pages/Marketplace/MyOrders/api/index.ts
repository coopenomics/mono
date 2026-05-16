import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { MarketplaceOrderPage, MarketplaceOrderStatusView, MarketplaceOrderView } from '../types';

export interface ListMyOrdersVariables {
  statuses?: MarketplaceOrderStatusView[];
  supplier_account?: string;
  offer_id?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export async function fetchMyOrders(variables: ListMyOrdersVariables = {}): Promise<MarketplaceOrderPage> {
  const { page, limit, sortBy, sortOrder, statuses, supplier_account, offer_id } = variables;
  const result = await client.Query(Queries.Marketplace.ListMyOrders.query, {
    variables: {
      input: {
        supplier_account,
        offer_id,
        statuses,
      },
      options: {
        page: page ?? 1,
        limit: limit ?? 50,
        sortBy: sortBy ?? 'updated_at',
        sortOrder: sortOrder ?? 'DESC',
      },
    },
  });
  return result[Queries.Marketplace.ListMyOrders.name] as unknown as MarketplaceOrderPage;
}

export async function fetchOrder(order_id: string): Promise<MarketplaceOrderView> {
  const result = await client.Query(Queries.Marketplace.GetOrder.query, {
    variables: { input: { order_id } },
  });
  return result[Queries.Marketplace.GetOrder.name] as unknown as MarketplaceOrderView;
}

export interface CancelOrderResult {
  order: MarketplaceOrderView;
  tx_hash: string;
}

export async function cancelOrder(order_id: string): Promise<CancelOrderResult> {
  const result = await client.Mutation(Mutations.Marketplace.CancelOrder.mutation, {
    variables: { input: { order_id } },
  });
  return result[Mutations.Marketplace.CancelOrder.name] as unknown as CancelOrderResult;
}
