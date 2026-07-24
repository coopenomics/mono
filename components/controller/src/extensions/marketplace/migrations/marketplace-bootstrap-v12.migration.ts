import type { IExtensionSchemaMigration } from '~/domain/extension/services/extension-schema-migration.service';
import { IConfig } from '../types';

/**
 * Bootstrap-миграция v12 расширения `market` — явная готовность к выдаче.
 * Оператор КУ выдачи вручную объявляет заказ готовым («Объявить выдачу» на
 * столе ПВЗ) ДО прихода заказчика: раньше единственным способом «открыть
 * выдачу» был скан QR уже пришедшего пайщика, и push «приходите заберите»
 * уходил человеку, который уже стоит у стойки.
 *
 * Изменения схемы `marketplace_order` (исполняет TypeORM `synchronize:true`
 * по декларации `MarketplaceOrderEntity`):
 *  - ADD `ready_announced_at` (timestamptz, nullable) — момент ручного
 *    объявления готовности. Backend-only операционный сигнал: on-chain статус
 *    остаётся ACCEPTED_TO_COOP (проводок нет), но заказчику уходит push и в
 *    его кабинете загорается «Готово к выдаче».
 *
 * Данные не мигрируются: исторические заказы остаются с NULL — для
 * ACCEPTED_TO_COOP это просто «ещё не объявлено».
 *
 * Конфиг расширения не меняется — `migrate` тождественный (нужен только для
 * bump schema_version, как у v6/v7/v8/v9/v10/v11).
 */
export const marketplaceBootstrapV12Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 12,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },
};
