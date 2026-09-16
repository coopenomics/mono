import type { IExtensionSchemaMigration } from '@coopenomics/extension-kit';
import { IConfig } from '../types';

/**
 * Bootstrap-миграция v19 расширения `market` — проекция заказа зеркалит
 * расчёт с поставщиком (задача 99D-14).
 *
 * Изменения схемы `marketplace_order` (исполняет TypeORM `synchronize:true`
 * по декларации `MarketplaceOrderEntity`):
 *  - ADD `accepted_cost` numeric(24,4) nullable — принятая стоимость по
 *    закрывающей подписи акта приёмки, on-chain mirror поля `accepted_cost`;
 *  - ADD `payout_status` varchar(12) nullable — on-chain mirror состояния
 *    выплаты поставщику (none / pending / completed / declined).
 *
 * Обе колонки заполняет синхронизация дельт `marketplace::orders`; по ним
 * инвариант по счёту 76 находит заказы с незавершённым расчётом. Данные не
 * мигрируются: у исторических строк значения придут со следующей дельтой.
 *
 * Конфиг расширения не меняется — `migrate` тождественный (нужен только для
 * bump schema_version).
 */
export const marketplaceBootstrapV19Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 19,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },
};
