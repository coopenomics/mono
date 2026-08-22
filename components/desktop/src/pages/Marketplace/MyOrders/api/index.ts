import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { MarketplaceOrderPage, MarketplaceOrderStatusView } from '../types';

// Получение оформляется у стойки ПВЗ: оператор формирует акт-бандл, пайщик
// подписывает его в гейте «подпись на месте» (единый путь выдачи). Поэтому
// «Мои заказы» подпись получения больше не несут — здесь только список и отмена.

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
  const { [Queries.Marketplace.ListMyOrders.name]: result } = await client.Query(
    Queries.Marketplace.ListMyOrders.query,
    {
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
    },
  );
  // Zeus отдаёт DateTime как unknown; сужаем скалярную дату до строки во view-типе.
  return result as MarketplaceOrderPage;
}

// Запрос одного заказа общий для всех столов — живёт в entity-слое
// (src/entities/MarketplaceOrder); здесь только реэкспорт, чтобы не заводить
// вторую копию той же операции.
export { fetchOrder } from 'src/entities/MarketplaceOrder';

export type CancelOrderResult =
  Mutations.Marketplace.CancelOrder.IOutput['marketplaceCancelOrder'];

export async function cancelOrder(order_id: string): Promise<CancelOrderResult> {
  const { [Mutations.Marketplace.CancelOrder.name]: result } = await client.Mutation(
    Mutations.Marketplace.CancelOrder.mutation,
    { variables: { input: { order_id } } },
  );
  return result;
}
