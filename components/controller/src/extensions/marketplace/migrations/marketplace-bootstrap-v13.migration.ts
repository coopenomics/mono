import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type {
  ExtensionSchemaMigrationAfterContext,
  IExtensionSchemaMigration,
} from '@coopenomics/extension-kit';
import { MARKETPLACE_STORAGE_CELL_LEGACY_LEVEL } from '../domain/entities/marketplace-storage-cell.types';
import {
  MARKETPLACE_STORAGE_CELL_REPOSITORY,
  type MarketplaceStorageCellDomainRepository,
} from '../domain/repositories/marketplace-storage-cell.repository';
import { IConfig } from '../types';

interface LegacyShelfRow {
  coopname: string;
  braname: string;
  shelf: string;
}

/**
 * Bootstrap-миграция v13 расширения `market` — адресное хранение (Эпик 19).
 * Место хранения переезжает со свободной строки-подписи полки на ячейку с
 * координатами «секция × ярус».
 *
 * Изменения схемы (исполняет TypeORM `synchronize:true` по декларациям
 * сущностей):
 *  - CREATE `marketplace_storage_cell` — ячейки хранения;
 *  - ADD `marketplace_inventory.cell_id` (nullable) — ссылка на ячейку.
 *
 * Перенос данных (эта миграция): каждая различная полка превращается в ячейку
 * своего участка. Прежняя подпись становится **и** секцией, **и** адресом
 * (`code`), ярус — первым: строку «A-12» нельзя достоверно разобрать на
 * координаты (полкой могло быть и «Холодильник»), а придумывать разбор — это
 * терять адреса, к которым оператор привык. Оператор переразложит сетку
 * осмысленно уже в интерфейсе.
 *
 * Идемпотентна: переносятся только позиции с `cell_id IS NULL`, ячейки
 * создаются с пропуском уже существующих координат. При ошибке версия не
 * повышается и перенос повторится на следующем старте.
 *
 * Колонка `marketplace_inventory.shelf` намеренно **не удаляется**: она всё ещё
 * объявлена в сущности, иначе `synchronize:true` снёс бы её на старте — раньше,
 * чем эта миграция успеет прочитать адреса. Снимается следующим релизом, после
 * подтверждения переноса на проде.
 *
 * Конфиг расширения не меняется — `migrate` тождественный.
 */
export const marketplaceBootstrapV13Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 13,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },

  async afterMigrate(ctx: ExtensionSchemaMigrationAfterContext): Promise<void> {
    // getDataSourceToken отдаёт union (string | Function | Type<DataSource>);
    // для DI-резолва нам достаточно строкового/символьного варианта.
    const dataSource = ctx.resolve<DataSource>(
      getDataSourceToken('marketplace') as string | symbol
    );
    const cellRepo = ctx.resolve<MarketplaceStorageCellDomainRepository>(
      MARKETPLACE_STORAGE_CELL_REPOSITORY
    );

    const legacyShelves: LegacyShelfRow[] = await dataSource.query(
      `SELECT coopname, braname, btrim(shelf) AS shelf
         FROM marketplace_inventory
        WHERE shelf IS NOT NULL
          AND btrim(shelf) <> ''
          AND cell_id IS NULL
        GROUP BY coopname, braname, btrim(shelf)`
    );

    if (legacyShelves.length === 0) {
      ctx.logInfo('marketplace v13: полок для переноса нет — склад уже адресный либо пуст.');
      return;
    }

    const created = await cellRepo.createGrid(
      legacyShelves.map((row) => ({
        coopname: row.coopname,
        braname: row.braname,
        section: row.shelf,
        level: MARKETPLACE_STORAGE_CELL_LEGACY_LEVEL,
        code: row.shelf,
      }))
    );
    ctx.logInfo(
      `marketplace v13: различных полок ${legacyShelves.length}, заведено ячеек ${created.length}.`
    );

    const [, movedCount]: [unknown, number] = await dataSource.query(
      `UPDATE marketplace_inventory AS i
          SET cell_id = c.id
         FROM marketplace_storage_cell AS c
        WHERE i.coopname = c.coopname
          AND i.braname = c.braname
          AND btrim(i.shelf) = c.code
          AND i.shelf IS NOT NULL
          AND i.cell_id IS NULL`
    );
    ctx.logInfo(`marketplace v13: позиций склада переведено на ячейки — ${movedCount ?? 0}.`);

    const [{ orphans }]: Array<{ orphans: string }> = await dataSource.query(
      `SELECT COUNT(*)::text AS orphans
         FROM marketplace_inventory
        WHERE shelf IS NOT NULL
          AND btrim(shelf) <> ''
          AND cell_id IS NULL`
    );
    if (Number(orphans) > 0) {
      // Не роняем старт: адрес остался в устаревшей колонке и переносится
      // повторно на следующем запуске, имущество при этом не потеряно.
      ctx.logWarn(
        `marketplace v13: у ${orphans} позиций полка не сопоставилась с ячейкой — перенос повторится при следующем старте.`
      );
    }
  },
};
