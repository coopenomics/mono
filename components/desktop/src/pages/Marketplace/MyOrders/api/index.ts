import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { MarketplaceOrderPage, MarketplaceOrderStatusView, MarketplaceOrderView } from '../types';

// Финальную подпись получения («Подписать и получить») заказчик ставит прямо
// в карточке «Моих заказов» — переиспользуем запрос акта (агрегат с подписью
// председателя) и mutation финализации из operator-стола выдачи. Отдельной
// страницы «Готово к получению» больше нет: статус READY_TO_RECEIVE — обычный
// этап заказа в общем списке.
export { getOrdererSignablePayload, finalizeIssuance } from '../../OperatorIssuance/api';
export type {
  MarketplaceOrderIssuanceView,
  MarketplaceOrderIssuanceFactView,
  MarketplaceIssuanceAggregateView,
  SignedDocumentInput,
} from '../../OperatorIssuance/api';

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

export async function fetchOrder(order_id: string): Promise<MarketplaceOrderView> {
  const { [Queries.Marketplace.GetOrder.name]: result } = await client.Query(
    Queries.Marketplace.GetOrder.query,
    { variables: { input: { order_id } } },
  );
  return result as MarketplaceOrderView;
}

export type CancelOrderResult =
  Mutations.Marketplace.CancelOrder.IOutput['marketplaceCancelOrder'];

export async function cancelOrder(order_id: string): Promise<CancelOrderResult> {
  const { [Mutations.Marketplace.CancelOrder.name]: result } = await client.Mutation(
    Mutations.Marketplace.CancelOrder.mutation,
    { variables: { input: { order_id } } },
  );
  return result;
}
