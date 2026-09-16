import type { IExtensionSchemaMigration } from '@coopenomics/extension-kit';
import { IConfig } from '../types';

/**
 * Bootstrap-миграция v21 расширения `market` — заявление на гарантийный
 * возврат помнит, что членский взнос ждёт пополнения общего кошелька
 * участка (задача 99D-15, решение владельца 10.09.2026).
 *
 * Изменения схемы `marketplace_return_claim` (исполняет TypeORM
 * `synchronize:true` по декларации `MarketplaceReturnClaimEntity`):
 *  - ADD `fee_refund_pending_at` timestamptz nullable — момент, когда совет
 *    отменил сделку без возврата взноса (заявка на цепи в `feepend`); крон
 *    повторяет `payretfee`, слушатель действия снимает отметку.
 *
 * Данные не мигрируются: до этой версии решение совета при нехватке средств
 * участка не исполнялось вовсе, ожидающих взносов в проекции нет.
 *
 * Конфиг расширения не меняется — `migrate` тождественный (нужен только для
 * bump schema_version).
 */
export const marketplaceBootstrapV21Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 21,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },
};
