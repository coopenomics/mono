import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type {
  MarketplaceOrderPage,
  MarketplaceOrderStatusView,
} from '../../MyOrders/types';
import { fetchMyOffers } from '../../OffererMyOffers/api';

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

/**
 * Эпик 15: поставщик принимает к поставке выбранные заказы (любое подмножество
 * группы offer × КУ) единым массивом. Backend оборачивает их в одну
 * партию-накопитель и акцептует on-chain.
 */
export async function acceptOrdersBatch(order_ids: string[]): Promise<void> {
  await client.Mutation(Mutations.Marketplace.AcceptOrdersBatch.mutation, {
    variables: { input: { order_ids } },
  });
}

/**
 * Эпик 15: поставщик отказывается от выбранных активных заказов массивом;
 * средства пайщиков разблокируются.
 */
export async function declineOrdersBatch(order_ids: string[], reason: string): Promise<void> {
  await client.Mutation(Mutations.Marketplace.DeclineOrdersBatch.mutation, {
    variables: { input: { order_ids, reason } },
  });
}

/**
 * Эпик 15: карта минимального объёма поставки на каждый КУ оферты —
 * `${offer_id}::${braname}` → min_supply_volume. Источник — собственные оферты
 * поставщика (`marketplaceListMyOffers`, поле delivery_points). min задаётся
 * поставщиком при публикации оферты; на столе входящих он служит ЦЕЛЬЮ сбора
 * партии-накопителя (не порогом — принять партию можно и меньшего объёма).
 */
export async function fetchSupplierMinVolumeMap(): Promise<Map<string, number>> {
  const page = await fetchMyOffers({ page: 1, limit: 500, sortBy: 'updated_at', sortOrder: 'DESC' });
  const map = new Map<string, number>();
  for (const offer of page.items) {
    for (const dp of offer.delivery_points ?? []) {
      map.set(`${offer.id}::${dp.braname}`, dp.min_supply_volume);
    }
  }
  return map;
}
