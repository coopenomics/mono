/**
 * Реестр всех заказов кооператива (стол администратора).
 * Источник истины — Zeus-вывод операции marketplaceListAllOrders из @coopenomics/sdk.
 */
import { Queries } from '@coopenomics/sdk';

type _RawOrderPage =
  Queries.Marketplace.ListAllOrders.IOutput['marketplaceListAllOrders'];

type _RawOrder = _RawOrderPage['items'][number];

/**
 * Zeus маппит DateTime в `unknown`. Структуру/enum'ы оставляем из Zeus, но
 * скалярную дату создания переопределяем на строку для форматирования в UI.
 */
export type AdminOrderView = Omit<_RawOrder, 'created_at'> & {
  created_at: string;
};

/** Страница заказов: обёртка из Zeus, но items со строгой датой создания. */
export type AdminOrderPage = Omit<_RawOrderPage, 'items'> & {
  items: AdminOrderView[];
};

/** Доменный статус заказа как строковый литерал (совпадает с Zeus-enum'ом). */
export type AdminOrderStatusView = `${AdminOrderView['status']}`;
