import type { IExtensionSchemaMigration } from '@coopenomics/extension-kit';
import { defaultConfig, IConfig } from '../types';

/**
 * Bootstrap-миграция v5 расширения `market` — техдолг 598-22.
 *
 * Story 5.5 / Эпик 5: `barcode_strategy` и `pack_size` переехали с
 * per-call параметра mutation маркировки на per-Offer поле.
 *
 * DDL колонок (`barcode_strategy varchar(32) DEFAULT 'PER_ORDER'`,
 * `pack_size integer NULL`) выполняется TypeORM `synchronize:true` из
 * декларации `MarketplaceOfferEntity`; PostgreSQL при ADD COLUMN с
 * непустым DEFAULT сам бэкфилит существующие строки — отдельный SQL
 * backfill не нужен. Миграция нужна только для bump schema_version,
 * чтобы пометить, что текущая инсталляция поддерживает per-Offer
 * стратегию маркировки.
 */
export const marketplaceBootstrapV5Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 5,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },
};
