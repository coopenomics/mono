/**
 * Story 4.6: типы orderer-стола «Мои заказы».
 * Источник истины — Zeus-вывод операции marketplaceListMyOrders из @coopenomics/sdk.
 */
import { Queries } from '@coopenomics/sdk';

type _RawOrderPage =
  Queries.Marketplace.ListMyOrders.IOutput['marketplaceListMyOrders'];

type _RawOrder = _RawOrderPage['items'][number];

/**
 * Zeus маппит DateTime в `unknown`. Структуру/enum'ы оставляем из Zeus, но
 * скалярную дату создания переопределяем на строку для форматирования в UI.
 */
export type MarketplaceOrderView = Omit<_RawOrder, 'created_at'> & {
  created_at: string;
};

/** Страница заказов: обёртка из Zeus, но items со строгой датой (см. MarketplaceOrderView). */
export type MarketplaceOrderPage = Omit<_RawOrderPage, 'items'> & {
  items: MarketplaceOrderView[];
};

/**
 * Источник статусов/типов цикла — Zeus-enum'ы из @coopenomics/sdk. Берём
 * строковое значение поля Zeus-вывода (`${...}`), чтобы UI-карты статусов и
 * фильтры одинаково принимали и строковые литералы, и enum-значения из
 * самих заказов. Никаких параллельных строковых union'ов.
 */
export type MarketplaceOrderStatusView = `${MarketplaceOrderView['status']}`;
