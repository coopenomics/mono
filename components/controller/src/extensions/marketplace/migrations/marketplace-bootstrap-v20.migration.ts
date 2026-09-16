import type { IExtensionSchemaMigration } from '@coopenomics/extension-kit';
import { IConfig } from '../types';

/**
 * Bootstrap-миграция v20 расширения `market` — проекция заказа зеркалит уценку
 * и помнит, какую уценку бэкенд обязан довезти до цепи (задача 99D-15).
 *
 * Изменения схемы `marketplace_order` (исполняет TypeORM `synchronize:true`
 * по декларации `MarketplaceOrderEntity`):
 *  - ADD `markdown_cost` numeric(24,4) nullable — on-chain mirror поля
 *    `markdown_cost` (списанная уценка, o.mkt.loss);
 *  - ADD `markdown_due` numeric(24,4) nullable — уценка, рассчитанная при
 *    закрытии выдачи; пока цепь не отзеркалила `markdown_cost`, крон
 *    повторяет `markdown`, а закрытие заказа откладывается.
 *
 * `markdown_cost` заполняет синхронизация дельт `marketplace::orders`;
 * `markdown_due` пишет сервис выдачи. Данные не мигрируются: у исторических
 * строк зеркало придёт со следующей дельтой, а уценки, не дошедшие до цепи
 * раньше, крон не увидит — их доводят вручную по журналу.
 *
 * Конфиг расширения не меняется — `migrate` тождественный (нужен только для
 * bump schema_version).
 */
export const marketplaceBootstrapV20Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 20,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },
};
