/**
 * Один заказ Стола заказов по его идентификатору. Операция
 * `marketplaceGetOrder` нужна сразу трём столам — заказчику (его собственный
 * заказ), администратору (любой заказ кооператива) и ПВЗ (любой заказ,
 * идущий на его участок), — поэтому запрос живёт в общем entity-слое, а не
 * дублируется по страницам. Что именно вернётся, решает бэкенд по правам
 * пайщика; ФИО сторон сделки приходят только тем, кто смотрит заказ «сверху».
 */
import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

type _RawOrder = Queries.Marketplace.GetOrder.IOutput['marketplaceGetOrder'];

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
