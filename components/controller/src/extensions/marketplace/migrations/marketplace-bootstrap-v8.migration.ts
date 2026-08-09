import type { IExtensionSchemaMigration } from '~/domain/extension/services/extension-schema-migration.service';
import { IConfig } from '../types';

/**
 * Bootstrap-миграция v8 расширения `market` — реквизиты ПВЗ переезжают в единый
 * источник правды (организацию участка), детализация перестаёт их хранить.
 *
 * Изменения схемы `marketplace_ku_details` (исполняет TypeORM `synchronize:true`
 * по декларации сущности `KuDetailsTypeormEntity`):
 *  - DROP `contact_phone`, `contact_email` — контакты участка живут в его
 *    организации (правит председатель в «Кооперативные участки»), резолвятся
 *    живьём через field-резолвер `MarketplaceKUDetails`;
 *  - `address_full` → `geocoded_address` (nullable): из отображаемого адреса
 *    превращается во внутренний кэш-ключ геокода — адрес, по которому
 *    последний раз посчитаны координаты (для ленивого reconcile при дрейфе).
 *
 * Данные старых колонок намеренно не переносятся: отображаемый адрес теперь
 * берётся из организации, а координаты пересчитаются ленивым reconcile при
 * первом чтении (дрейф `geocoded_address=NULL` vs адрес организации).
 *
 * Конфиг расширения не меняется — `migrate` тождественный (нужен только для
 * bump schema_version, как у v6/v7).
 */
export const marketplaceBootstrapV8Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 8,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },
};
