import { Inject, Injectable, Optional } from '@nestjs/common';
import { CHAIN_CHANGES_PORT, type IChainChangesPort, type InnerChainChangesTable } from '@coopenomics/innercoop';
import { MarketContract } from 'cooptypes';

/** Имя расширения в реестре — `code` его таблиц в ленте изменений. */
const CODE = 'market';

/**
 * Таблицы Стола заказов в ленте изменений. Одни и те же строки нужны разным
 * ролям — заказчику, поставщику, оператору участка, председателю, — а сигнал
 * данных строки не несёт, поэтому таблицы открыты всем пайщикам кооператива.
 * Личная — только корзина заказчика.
 */
export const MARKETPLACE_LIVE_TABLES: InnerChainChangesTable[] = [
  ...[
    'marketplace_order',
    'marketplace_offer',
    'marketplace_inventory',
    'marketplace_apl_reception',
    'marketplace_return_claim',
    'marketplace_outgoing_payment_request',
    'marketplace_writeoff_proposal',
    'marketplace_stock_proposal',
    'marketplace_issuance_saga',
    'marketplace_ku_details',
    'marketplace_container',
    'marketplace_moderation_log',
    'marketplace_shipment',
    'marketplace_consolidated_request',
    'marketplace_storage_cell',
    'marketplace_supplier',
    'marketplace_supplier_claim',
    'marketplace_supplier_settings',
    'marketplace_vitrine',
    'marketplace_category',
    'marketplace_ttn_document',
    'marketplace_cart_item',
  ].map((table) => ({ code: CODE, table })),
  { code: CODE, table: 'marketplace_cart', owner_field: 'orderer_account' },
];

/**
 * Таблицы контракта Стола заказов, которые стол читает из цепи напрямую, — сбор
 * с оборота. Заказы, возвраты и списания цепи стол читает из базы расширения:
 * их сигнал даёт запись зеркала.
 */
export const MARKETPLACE_LIVE_CHAIN_TABLES: InnerChainChangesTable[] = [
  { code: MarketContract.contractName.production, table: MarketContract.Tables.Config.tableName },
];


/**
 * Живые обновления Стола заказов по общей ленте изменений (C28-83): объявляет
 * таблицы расширения. Сигнал о записи шлёт слой базы — запись идёт через
 * Kysely, и после её фиксации лента получает ключ строки. Без порта ленты
 * (узел без ядра ленты) объявлять нечего, стол работает как прежде.
 */
@Injectable()
export class MarketplaceLiveFeedSubscriber {
  constructor(@Optional() @Inject(CHAIN_CHANGES_PORT) chainChanges: IChainChangesPort | null = null) {
    chainChanges?.declareLocalTables(MARKETPLACE_LIVE_TABLES);
    chainChanges?.declareTables(MARKETPLACE_LIVE_CHAIN_TABLES);
  }
}
