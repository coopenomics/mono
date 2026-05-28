import type { IExtensionSchemaMigration } from '~/domain/extension/services/extension-schema-migration.service';
import { defaultConfig, IConfig } from '../types';

/**
 * Bootstrap-миграция v6 расширения `market` — Эпик 8 (списание скоропорта).
 *
 * Что добавляется:
 *  - таблица `marketplace_writeoff_proposal` (DRAFT → ON_AGENDA → AUTHORIZED →
 *    EXECUTING → EXECUTED / REJECTED) — Story 8.1;
 *  - колонка `marketplace_inventory.expiry_date` (Story 8.3) — TypeORM
 *    `synchronize:true` создаёт её ADD COLUMN nullable, backfill не нужен;
 *  - блок настроек `IConfig.writeoff` (`auto_proposal_enabled`) —
 *    bootstrap-merge со значениями по умолчанию.
 *
 * DDL выполняется `synchronize:true` по декларации сущностей; миграция нужна
 * для bump schema_version и для гарантии, что текущая инсталляция понимает
 * новый блок конфигурации.
 */
export const marketplaceBootstrapV6Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 6,

  migrate(oldConfig, def) {
    const baseline = { ...def, ...oldConfig };
    return {
      ...baseline,
      writeoff: {
        ...defaultConfig.writeoff,
        ...(baseline.writeoff ?? {}),
      },
    };
  },
};
