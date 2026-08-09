// extensions/powerup/migrations/powerup-schema-v2.migration.ts

import type { IExtensionSchemaMigration } from '@coopenomics/extension-kit';

/**
 * Старая конфигурация powerup (v1)
 */
interface IPowerupConfigV1 {
  dailyPackageSize?: number;
  topUpAmount?: number; // Удаляем это поле
  systemSymbol?: string;
  systemPrecision?: number;
  thresholds?: {
    cpu?: number; // Абсолютные значения
    net?: number;
    ram?: number;
  };
  lastDailyReplenishmentDate?: string;
}

/**
 * Новая конфигурация powerup (v2)
 */
interface IPowerupConfigV2 {
  dailyPackageSize?: number;
  systemSymbol?: string;
  systemPrecision?: number;
  thresholds?: {
    cpu?: number; // Проценты (0-100)
    net?: number;
    ram?: number;
  };
  lastDailyReplenishmentDate?: string;
}

/**
 * Миграция схемы powerup с v1 на v2
 *
 * Изменения:
 * 1. Удаление поля topUpAmount
 * 2. Преобразование thresholds из абсолютных значений в проценты
 *    (для этого нужно знать текущие квоты, но так как мы не можем их получить здесь,
 *     устанавливаем дефолтные значения процентов)
 */
export const powerupSchemaV2Migration: IExtensionSchemaMigration<IPowerupConfigV1, IPowerupConfigV2> = {
  extensionName: 'powerup',
  version: 2,

  migrate(oldConfig: IPowerupConfigV1, defaultConfig: IPowerupConfigV2): IPowerupConfigV2 {
    const newConfig: IPowerupConfigV2 = {
      ...defaultConfig,
      dailyPackageSize: oldConfig.dailyPackageSize ?? defaultConfig.dailyPackageSize,
      systemSymbol: oldConfig.systemSymbol ?? defaultConfig.systemSymbol,
      systemPrecision: oldConfig.systemPrecision ?? defaultConfig.systemPrecision,
      lastDailyReplenishmentDate: oldConfig.lastDailyReplenishmentDate ?? defaultConfig.lastDailyReplenishmentDate,
    };

    // Преобразуем thresholds
    // Если значения больше 100, считаем их абсолютными и конвертируем в проценты
    // Поскольку мы не знаем текущие квоты, используем дефолтные значения процентов
    if (oldConfig.thresholds) {
      newConfig.thresholds = {
        cpu:
          oldConfig.thresholds.cpu !== undefined
            ? oldConfig.thresholds.cpu > 100
              ? 70 // Дефолтный процент, если было абсолютное значение
              : oldConfig.thresholds.cpu
            : defaultConfig.thresholds?.cpu ?? 70,
        net:
          oldConfig.thresholds.net !== undefined
            ? oldConfig.thresholds.net > 100
              ? 70
              : oldConfig.thresholds.net
            : defaultConfig.thresholds?.net ?? 70,
        ram:
          oldConfig.thresholds.ram !== undefined
            ? oldConfig.thresholds.ram > 100
              ? 70
              : oldConfig.thresholds.ram
            : defaultConfig.thresholds?.ram ?? 70,
      };
    } else {
      newConfig.thresholds = defaultConfig.thresholds;
    }

    // Удаляем topUpAmount (не копируем его в новую конфигурацию)

    return newConfig;
  },
};
