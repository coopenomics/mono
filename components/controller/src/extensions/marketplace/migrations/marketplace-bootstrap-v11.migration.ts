import type { IExtensionSchemaMigration } from '~/domain/extension/services/extension-schema-migration.service';
import { IConfig } from '../types';

/**
 * Bootstrap-миграция v11 расширения `market` — разведение срока годности и
 * гарантийного срока возврата.
 *
 * Раньше единственное поле `Offer.warranty_days` работало на две сущности
 * сразу: и на окно возврата имущества (on-chain `warranty_until` в `submretrn`),
 * и на списание скоропорта (off-chain `expiry_date` позиции склада). Теперь они
 * разведены:
 *  - ADD `shelf_life_days` (default 0) — срок годности имущества в днях. Задаёт
 *    поставщик при создании предложения; по нему на приёмке считается
 *    `marketplace_inventory.expiry_date` (основа крон-списания скоропорта, Эпик 8).
 *  - `warranty_days` теперь устанавливает модератор при одобрении (перестаёт
 *    приходить из формы поставщика) и питает только окно возврата на контракте.
 *
 * Изменение схемы `marketplace_offer` (исполняет TypeORM `synchronize:true`
 * по декларации `MarketplaceOfferEntity`):
 *  - ADD `shelf_life_days` integer NOT NULL default 0.
 *
 * Данные не мигрируются: существующие офферы получают `shelf_life_days=0`
 * (списание по сроку для них не срабатывает, пока поставщик не переиздаст
 * предложение с указанием срока годности) — по той же конвенции, что v9/v10.
 * Контракт не затрагивается: списание скоропорта решается off-chain кроном по
 * `expiry_date`, on-chain проверок сроков в `propwroff/execwroff/confirmwroff`
 * нет. Конфиг расширения не меняется — `migrate` тождественный (нужен только
 * для bump schema_version).
 */
export const marketplaceBootstrapV11Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 11,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },
};
