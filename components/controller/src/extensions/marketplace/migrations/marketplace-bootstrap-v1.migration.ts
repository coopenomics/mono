import type {
  IExtensionSchemaMigration,
  ExtensionSchemaMigrationAfterContext,
} from '@coopenomics/extension-kit';
import { defaultConfig, IConfig } from '../types';

/**
 * Bootstrap-миграция расширения `market` (Стол заказов).
 *
 * Story 1.1 (epics.md, Эпик 1). Гарантирует, что `extension.config` после
 * установки содержит все ключи `defaultConfig`; `currentConfig` сохраняется
 * поверх дефолтов — пользовательские переопределения не теряются. Фаза
 * `afterMigrate` — no-op: data-миграции на этапе MVP-bootstrap не нужны
 * (entity-таблицы marketplace::request* появятся в Эпике 4).
 */
export const marketplaceBootstrapV1Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 1,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },

  async afterMigrate(_ctx: ExtensionSchemaMigrationAfterContext) {
    // no-op для Story 1.1
  },
};
