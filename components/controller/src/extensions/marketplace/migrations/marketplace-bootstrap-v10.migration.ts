import type { IExtensionSchemaMigration } from '@coopenomics/extension-kit';
import { IConfig } from '../types';

/**
 * Bootstrap-миграция v10 расширения `market` — кооператив получает собственные
 * категории Стола заказов поверх общих baseline-категорий.
 *
 * Изменение схемы `marketplace_category` (исполняет TypeORM `synchronize:true`
 * по декларации `MarketplaceCategoryEntity`):
 *  - ADD `coopname` (nullable) — владелец кастомной категории; NULL у общих
 *    baseline-категорий, имя кооператива у добавленных им собственных.
 *
 * Данные не мигрируются: существующие baseline-строки остаются с `coopname=NULL`
 * и `mvp_baseline=true`. Конфиг расширения не меняется — `migrate` тождественный
 * (нужен только для bump schema_version, как у v6/v7/v8/v9).
 */
export const marketplaceBootstrapV10Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 10,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },
};
