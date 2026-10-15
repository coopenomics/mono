import type { IExtensionSchemaMigration } from '@coopenomics/extension-kit';
import { IConfig } from '../types';

/**
 * Bootstrap-миграция v23 расширения `market` — в конфиг добавлена группа
 * `issuance` с числом одновременно подаваемых заявлений при выдаче из бандла.
 *
 * Зачем: заявления бандла подавались по одному, и выдача восьми позиций
 * занимала 37 с — браузер обрывал запрос по таймауту (тестнет, 11.09.2026).
 * Позиции теперь идут параллельно, предел берётся из конфига.
 *
 * Данные не мигрируются. Кооперативам, установившим расширение раньше,
 * значение подставляется из умолчаний.
 */
export const marketplaceBootstrapV23Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 23,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig, issuance: { ...def.issuance, ...(oldConfig.issuance ?? {}) } };
  },
};
