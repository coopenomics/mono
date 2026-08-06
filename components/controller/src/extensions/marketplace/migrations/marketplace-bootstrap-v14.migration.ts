import type { IExtensionSchemaMigration } from '~/domain/extension/services/extension-schema-migration.service';
import { defaultConfig, IConfig } from '../types';

/**
 * Bootstrap-миграция v14 расширения `market` — настройки адресного хранения
 * (Эпик 19). Добавляет блок `warehouse` с тремя независимыми переключателями:
 * боксы, координатные ячейки, обязательность указания места при приёмке.
 *
 * Все три выключены по умолчанию, поэтому уже установленные кооперативы
 * поведения не меняют: склад продолжает работать как до эпика, пока
 * председатель не включит нужное в настройках расширения.
 *
 * Блок мёржится с дефолтом явно: обычный `{ ...def, ...oldConfig }` затёр бы
 * новый ключ только при его отсутствии, но у частично заполненного `warehouse`
 * (если кооператив уже правил настройки между релизами) недостающие
 * переключатели остались бы `undefined`.
 */
export const marketplaceBootstrapV14Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 14,

  migrate(oldConfig, def) {
    return {
      ...def,
      ...oldConfig,
      warehouse: {
        ...defaultConfig.warehouse,
        ...(oldConfig?.warehouse ?? {}),
      },
    };
  },
};
