/**
 * Один заказ Стола заказов по его идентификатору. Операция
 * `marketplaceGetOrder` нужна сразу трём столам — заказчику (его собственный
 * заказ), администратору (любой заказ кооператива) и ПВЗ (любой заказ,
 * идущий на его участок), — поэтому запрос живёт в общем entity-слое, а не
 * дублируется по страницам. Что именно вернётся, решает бэкенд по правам
 * пайщика; ФИО сторон сделки приходят только тем, кто смотрит заказ «сверху».
 */
import { Queries, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

type _RawOrder = Queries.Marketplace.GetOrder.IOutput['marketplaceGetOrder'];

/** Строка ленты заказов — то же, что отдают реестры обоих столов. */
export type MarketplaceOrderListView =
  Queries.Marketplace.ListAllOrders.IOutput['marketplaceListAllOrders']['items'][number];

/** Zeus маппит DateTime в `unknown`; скалярную дату создания сужаем до строки для форматирования в UI. */
export type MarketplaceOrderDetailView = Omit<_RawOrder, 'created_at'> & {
  created_at: string;
};

export async function fetchOrder(order_id: string): Promise<MarketplaceOrderDetailView> {
  const { [Queries.Marketplace.GetOrder.name]: result } = await client.Query(
    Queries.Marketplace.GetOrder.query,
    { variables: { input: { order_id } } },
  );
  return result as MarketplaceOrderDetailView;
}

/**
 * Исполненные заказы для свода оборота. Запрос тот же, что у реестра заказов,
 * но зовут его теперь и «Экономика» кооператива, и «Экономика участка» —
 * поэтому он живёт в общем слое сущности, а не в api одного реестра.
 *
 * `braname` задаёт участок (стол ПВЗ, `Order:read:own-KU`); без него берётся
 * весь кооператив (стол администратора, `Order:read:all`).
 */
export async function fetchOrdersForTurnover(input: {
  braname?: string | null;
  limit?: number;
}): Promise<MarketplaceOrderListView[]> {
  const options = {
    page: 1,
    limit: input.limit ?? 500,
    sortBy: 'updated_at',
    sortOrder: 'DESC' as const,
  };
  const filter = { statuses: [Zeus.MarketplaceOrderStatus.RECEIVED] };

  if (input.braname) {
    const { [Queries.Marketplace.ListBranchOrders.name]: page } = await client.Query(
      Queries.Marketplace.ListBranchOrders.query,
      { variables: { braname: input.braname, input: filter, options } },
    );
    return (page.items ?? []) as MarketplaceOrderListView[];
  }

  const { [Queries.Marketplace.ListAllOrders.name]: page } = await client.Query(
    Queries.Marketplace.ListAllOrders.query,
    { variables: { input: filter, options } },
  );
  return (page.items ?? []) as MarketplaceOrderListView[];
}
