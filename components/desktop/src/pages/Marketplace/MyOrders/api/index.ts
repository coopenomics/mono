import { sendPOST } from 'src/shared/api/axios';
import type { MarketplaceOrderPage, MarketplaceOrderView } from '../types';

/**
 * Story 4.6: raw GraphQL к marketplace-backend для orderer-стола
 * «Мои заказы» + общий cancel-mutation (Story 4.4).
 *
 * Техдолг: после `pnpm cooptypes:gen-zeus` — переписать на типизированные
 * `Queries.Marketplace.ListMyOrders` / `Mutations.Marketplace.CancelOrder`
 * (см. PR #381 паттерн).
 */

const MARKETPLACE_ORDER_FIELDS = `
  id
  coopname
  order_hash
  orderer_account
  offer_id
  offer_hash
  supplier_account
  delivery_braname
  quantity
  price_per_unit
  total_cost
  cycle_type
  cycle_id
  warranty_period_secs
  warranty_until
  status
  last_status_reason
  blocked_at
  accepted_at
  received_at
  cancelled_at
  created_at
  updated_at
`;

const LIST_MY_ORDERS_QUERY = `
  query MarketplaceListMyOrders($input: MarketplaceListOrdersInput) {
    marketplaceListMyOrders(input: $input) {
      items { ${MARKETPLACE_ORDER_FIELDS} }
      totalCount
      totalPages
      currentPage
    }
  }
`;

const GET_ORDER_QUERY = `
  query MarketplaceGetOrder($input: MarketplaceGetOrderInput!) {
    marketplaceGetOrder(input: $input) { ${MARKETPLACE_ORDER_FIELDS} }
  }
`;

const CANCEL_ORDER_MUTATION = `
  mutation MarketplaceCancelOrder($input: MarketplaceCancelOrderInput!) {
    marketplaceCancelOrder(input: $input) {
      order { ${MARKETPLACE_ORDER_FIELDS} }
      tx_hash
    }
  }
`;

export interface ListMyOrdersVariables {
  statuses?: string[];
  supplier_account?: string;
  offer_id?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export async function fetchMyOrders(variables: ListMyOrdersVariables = {}): Promise<MarketplaceOrderPage> {
  const body = await sendPOST('/v1/graphql', {
    query: LIST_MY_ORDERS_QUERY,
    variables: { input: variables },
  });
  if (body?.errors?.length) throw new Error(body.errors[0].message);
  return body.data.marketplaceListMyOrders;
}

export async function fetchOrder(order_id: string): Promise<MarketplaceOrderView> {
  const body = await sendPOST('/v1/graphql', {
    query: GET_ORDER_QUERY,
    variables: { input: { order_id } },
  });
  if (body?.errors?.length) throw new Error(body.errors[0].message);
  return body.data.marketplaceGetOrder;
}

export interface CancelOrderResult {
  order: MarketplaceOrderView;
  tx_hash: string;
}

export async function cancelOrder(order_id: string): Promise<CancelOrderResult> {
  const body = await sendPOST('/v1/graphql', {
    query: CANCEL_ORDER_MUTATION,
    variables: { input: { order_id } },
  });
  if (body?.errors?.length) throw new Error(body.errors[0].message);
  return body.data.marketplaceCancelOrder;
}
