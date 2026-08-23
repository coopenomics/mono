/**
 * Реестр заказов — общий вид строки. Источник истины — Zeus-вывод операций
 * marketplaceListAllOrders (стол администратора, все заказы кооператива) и
 * marketplaceListBranchOrders (стол ПВЗ, заказы одного КУ) — обе отдают
 * идентичный MarketplaceOrderPaginationResult, поэтому один тип на оба стола.
 */
import { Queries } from '@coopenomics/sdk';

type _RawOrderPage = Queries.Marketplace.ListAllOrders.IOutput['marketplaceListAllOrders'];
type _RawOrder = _RawOrderPage['items'][number];

/** Zeus маппит DateTime в `unknown`. Структуру/enum'ы оставляем из Zeus, скалярную дату создания — строкой для форматирования в UI. */
export type OrderRegistryView = Omit<_RawOrder, 'created_at'> & {
  created_at: string;
};

/** Страница заказов: обёртка из Zeus, но items со строгой датой создания. */
export type OrderRegistryPage = Omit<_RawOrderPage, 'items'> & {
  items: OrderRegistryView[];
};

/** Доменный статус заказа как строковый литерал (совпадает с Zeus-enum'ом). */
export type OrderRegistryStatusView = `${OrderRegistryView['status']}`;

/** Полный набор статусов для чипов-фильтра (порядок — по жизненному циклу). */
export const ALL_ORDER_REGISTRY_STATUSES: OrderRegistryStatusView[] = [
  'ACTIVE',
  'ACCEPTED_PENDING_SUPPLIER',
  'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL',
  'ACCEPTED',
  'SUPPLY_PREPARED',
  'ACCEPTED_TO_COOP',
  'READY_TO_RECEIVE',
  'RECEIVED',
  'RETURNED',
  'CANCELLED_BY_ORDERER',
  'CANCELLED_BY_SUPPLIER',
];
