import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type {
  ExtensionSchemaMigrationAfterContext,
  IExtensionSchemaMigration,
} from '@coopenomics/extension-kit';
import { IConfig } from '../types';
import { MarketplaceInventoryStatuses } from '../domain/entities/marketplace-inventory.types';

/**
 * Bootstrap-миграция v24 расширения `market` — выданное и списанное имущество
 * освобождает бокс и ячейку.
 *
 * Зачем: место хранения отвечает на вопрос «где это лежит сейчас». Выдача и
 * списание меняли только состояние позиции, а бокс с ячейкой оставались
 * записанными, и коробка числилась занятой имуществом, которого на участке
 * давно нет: реестр тары показывал «2 поз.» у пустого бокса, а вывести его из
 * оборота не давал непустой состав (тестнет, 14.09.2026). Впредь место
 * снимается самим переходом; здесь чистятся записи, накопленные до правки.
 *
 * Идемпотентна: трогает только позиции, покинувшие склад, у которых место ещё
 * записано.
 */
export const marketplaceBootstrapV24Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 24,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },

  async afterMigrate(ctx: ExtensionSchemaMigrationAfterContext): Promise<void> {
    const dataSource = ctx.resolve<DataSource>(getDataSourceToken('marketplace') as string | symbol);
    if (!dataSource) return;

    const result: unknown = await dataSource.query(
      `UPDATE marketplace_inventory
          SET container_id = NULL, cell_id = NULL
        WHERE status IN ($1, $2)
          AND (container_id IS NOT NULL OR cell_id IS NOT NULL)
      RETURNING id`,
      [MarketplaceInventoryStatuses.ISSUED, MarketplaceInventoryStatuses.WRITTEN_OFF]
    );
    // Драйвер postgres в TypeORM отдаёт на UPDATE … RETURNING пару [строки, счётчик].
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : Array.isArray(result) ? result : [];

    if (rows.length > 0) {
      ctx.logInfo(`Позиции склада, покинувшие участок, освободили бокс и ячейку: ${rows.length}.`);
    }
  },
};
