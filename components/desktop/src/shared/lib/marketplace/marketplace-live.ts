import type { ChainTableRef } from 'src/shared/lib/realtime';

/** Код расширения Стола заказов в ленте изменений (имя в реестре — `market`). */
const CODE = 'market';

/**
 * Виды данных Стола заказов и их таблицы в общей ленте изменений (C28-83).
 * Экран объявляет, какие данные он показывает, и перечитывается, когда
 * меняется любая их таблица, — вместо прежней отдельной подписки
 * `marketplaceEvents` с типизированными событиями.
 */
const TABLES = {
  order: ['marketplace_order', 'marketplace_issuance_saga'],
  reception: ['marketplace_apl_reception', 'marketplace_shipment', 'marketplace_ttn_document'],
  return: ['marketplace_return_claim'],
  offer: ['marketplace_offer', 'marketplace_inventory', 'marketplace_moderation_log'],
  payment: ['marketplace_outgoing_payment_request'],
  writeoff: ['marketplace_writeoff_proposal', 'marketplace_inventory'],
  stock: ['marketplace_stock_proposal', 'marketplace_inventory'],
  warehouse: ['marketplace_inventory', 'marketplace_container', 'marketplace_storage_cell'],
  ku: ['marketplace_ku_details'],
  catalog: ['marketplace_category', 'marketplace_vitrine', 'marketplace_supplier'],
  cart: ['marketplace_cart', 'marketplace_cart_item'],
} as const;

export type MarketLiveKind = keyof typeof TABLES;

/** Таблицы ленты для видов данных экрана — без повторов. */
export function marketLiveTables(...kinds: MarketLiveKind[]): ChainTableRef[] {
  const names = new Set<string>();
  kinds.forEach((kind) => TABLES[kind].forEach((table) => names.add(table)));
  return [...names].map((table) => ({ code: CODE, table }));
}
