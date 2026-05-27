import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type {
  MarketplaceOrderPage,
  MarketplaceOrderStatusView,
} from '../../MyOrders/types';

/**
 * Эпик 4 / Story 4.5: incoming orders для поставщика.
 * Backend Resolver: marketplace-order.resolver.ts → marketplaceListSupplierOrders.
 * Read policy: 'Order' 'read:to-self' (RequireMarketplaceAccess).
 *
 * Возвращает заказы, где supplier_account = текущий пайщик. Reused
 * MarketplaceOrderView из MyOrders/types (тот же DTO, только фильтр другой).
 */

export interface ListSupplierOrdersVariables {
  statuses?: MarketplaceOrderStatusView[];
  orderer_account?: string;
  offer_id?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export async function fetchSupplierOrders(
  variables: ListSupplierOrdersVariables = {},
): Promise<MarketplaceOrderPage> {
  const { page, limit, sortBy, sortOrder, statuses, orderer_account, offer_id } = variables;
  const { [Queries.Marketplace.ListSupplierOrders.name]: result } = await client.Query(
    Queries.Marketplace.ListSupplierOrders.query,
    {
      variables: {
        input: {
          orderer_account,
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
    },
  );
  // Zeus отдаёт DateTime как unknown; сужаем скалярную дату до строки во view-типе.
  return result as MarketplaceOrderPage;
}

export async function acceptIndividualOrder(order_id: string): Promise<void> {
  await client.Mutation(Mutations.Marketplace.AcceptIndividualOrder.mutation, {
    variables: { input: { order_id } },
  });
}

export async function declineIndividualOrder(order_id: string, reason: string): Promise<void> {
  await client.Mutation(Mutations.Marketplace.DeclineIndividualOrder.mutation, {
    variables: { input: { order_id, reason } },
  });
}
