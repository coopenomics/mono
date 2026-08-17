import type { IExtensionSchemaMigration } from '@coopenomics/extension-kit';
import { IConfig } from '../types';

/**
 * Bootstrap-миграция v9 расширения `market` — склад КУ переходит на приёмочную
 * модель: позиция инвентаря рождается на приёмке кооперативом по акту
 * (`ACCEPTED_TO_COOP`), а не на маркировке. Штрих-код и полка становятся
 * опциональными атрибутами позиции.
 *
 * Изменения схемы `marketplace_inventory` (исполняет TypeORM `synchronize:true`
 * по декларации `MarketplaceInventoryEntity`):
 *  - `barcode_value`, `barcode_format` → nullable (позиция лежит на складе и без
 *    штрих-кода; новый стартовый статус `RECEIVED`);
 *  - `labeled_at`, `labeled_by_operator_account` → nullable (заполняются только
 *    при маркировке);
 *  - ADD `shelf` (nullable) — полка/ячейка склада, свободная строка;
 *  - ADD `received_at`, `received_by_operator_account` (nullable) — момент и
 *    оператор приёмки по акту; для исторических промаркированных записей
 *    остаются NULL, mapper берёт `created_at`/`labeled_by` как опору.
 *
 * Данные не мигрируются: исторические записи были созданы маркировкой и уже
 * имеют barcode/labeled_*; новая модель применяется к будущим приёмкам.
 *
 * Конфиг расширения не меняется — `migrate` тождественный (нужен только для
 * bump schema_version, как у v6/v7/v8).
 */
export const marketplaceBootstrapV9Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 9,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },
};
