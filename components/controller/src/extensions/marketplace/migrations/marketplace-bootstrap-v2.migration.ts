import type {
  IExtensionSchemaMigration,
  ExtensionSchemaMigrationAfterContext,
} from '~/domain/extension/services/extension-schema-migration.service';
import { defaultConfig, IConfig } from '../types';

/**
 * Bootstrap-миграция v2 расширения `market` (Story 1.9 — L1 онбординг).
 *
 * Добавляет в `extension.config` поле `coopAcceptance` (статус принятия
 * положения ЦПП Советом). Не трогает остальные поля v1 конфига.
 *
 * Идемпотентна: `coopAcceptance` от существующего конфига сохраняется как
 * есть (пользовательский accepted=true после Story 1.9 не сбрасывается),
 * отсутствующие подполя берутся из defaultConfig.coopAcceptance.
 */
export const marketplaceBootstrapV2Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 2,

  migrate(oldConfig, def) {
    return {
      ...def,
      ...oldConfig,
      coopAcceptance: {
        ...def.coopAcceptance,
        ...(oldConfig?.coopAcceptance ?? {}),
      },
    };
  },

  async afterMigrate(_ctx: ExtensionSchemaMigrationAfterContext) {
    // no-op — изменение чисто конфигурационное, без data-миграций.
  },
};
