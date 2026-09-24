import { BranchContract, MarketContract } from 'cooptypes';
import { liveTable, type ChainTableRef } from 'src/shared/lib/realtime';

/** Код расширения Стола заказов в ленте изменений (имя в реестре — `market`). */
const CODE = 'market';

const local = (...tables: string[]): ChainTableRef[] => tables.map((table) => ({ code: CODE, table }));

/**
 * Виды данных Стола заказов и их таблицы в общей ленте изменений (C28-83).
 * Экран объявляет, какие данные он показывает, и перечитывается, когда
 * меняется любая их таблица, — вместо прежней отдельной подписки
 * `marketplaceEvents` с типизированными событиями. Почти всё стол читает из
 * базы расширения; сбор с оборота, участки и их веса — из цепи.
 */
const TABLES = {
  order: local('marketplace_order', 'marketplace_issuance_saga'),
  reception: local('marketplace_apl_reception', 'marketplace_shipment', 'marketplace_ttn_document'),
  return: local('marketplace_return_claim'),
  offer: local('marketplace_offer', 'marketplace_inventory', 'marketplace_moderation_log'),
  payment: local('marketplace_outgoing_payment_request'),
  writeoff: local('marketplace_writeoff_proposal', 'marketplace_inventory'),
  stock: local('marketplace_stock_proposal', 'marketplace_inventory'),
  warehouse: local('marketplace_inventory', 'marketplace_container', 'marketplace_storage_cell'),
  ku: [...local('marketplace_ku_details'), liveTable(BranchContract, BranchContract.Tables.Branches)],
  catalog: local('marketplace_category', 'marketplace_vitrine', 'marketplace_supplier'),
  cart: local('marketplace_cart', 'marketplace_cart_item'),
  supplier: local('marketplace_supplier', 'marketplace_supplier_claim', 'marketplace_supplier_settings'),
  economy: [
    liveTable(MarketContract, MarketContract.Tables.Config),
    liveTable(BranchContract, BranchContract.Tables.Weights),
    liveTable(BranchContract, BranchContract.Tables.WeightTotals),
    liveTable(BranchContract, BranchContract.Tables.Aids),
  ],
} satisfies Record<string, ChainTableRef[]>;

export type MarketLiveKind = keyof typeof TABLES;

/** Таблицы ленты для видов данных экрана — без повторов. */
export function marketLiveTables(...kinds: MarketLiveKind[]): ChainTableRef[] {
  const refs = new Map<string, ChainTableRef>();
  kinds.forEach((kind) => TABLES[kind].forEach((ref) => refs.set(`${ref.code}:${ref.table}`, ref)));
  return [...refs.values()];
}
