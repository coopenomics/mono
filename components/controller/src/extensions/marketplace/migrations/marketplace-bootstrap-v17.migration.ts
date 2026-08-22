import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type {
  ExtensionSchemaMigrationAfterContext,
  IExtensionSchemaMigration,
} from '@coopenomics/extension-kit';
import { IConfig } from '../types';
import { RECOMPUTE_CONTAINER_VOLUME_SQL } from './marketplace-bootstrap-v15.migration';

/**
 * Bootstrap-миграция v17 расширения `market` — габариты тары переезжают с
 * миллиметров на сантиметры (Эпик 19).
 *
 * Зачем: в сантиметрах тару меряют на месте — «ящик сто на сто на тридцать».
 * Миллиметры это язык каталогов поставщиков тары, а не кладовщика с рулеткой, и
 * на них легко ошибиться на порядок: «100 × 100 × 30» в миллиметрах даёт
 * мыльницу в 0,0003 м³ вместо ящика в 0,3 м³, причём ошибка тихая — числа-то
 * введены правильные.
 *
 * Изменение схемы (исполняет TypeORM `synchronize:true` по декларации
 * сущности): `length_mm`/`width_mm`/`height_mm` уступают место
 * `length_cm`/`width_cm`/`height_cm`.
 *
 * Перенос данных: числа переносятся **как есть**, без деления на десять. Это
 * не пересчёт единиц, а исправление подписи: расширение до релиза, реальных
 * установок нет, а единственные заведённые значения вводились именно как
 * сантиметры — их и надо оставить.
 *
 * Оговорка: скопировать значения удаётся, только если TypeORM переименовал
 * колонки, а не пересоздал. Когда меняются сразу три колонки, он обычно именно
 * пересоздаёт — старые значения теряются вместе со старыми колонками ещё до
 * запуска этой миграции, и восстановить их неоткуда. Габариты тогда придётся
 * ввести заново; ошибиться некритично — их видно на экране рядом с объёмом.
 *
 * Затем объём пересчитывается общим SQL — уже по формуле «см³ → м³».
 *
 * Идемпотентна: копирование выполняется только при наличии старых колонок,
 * пересчёт — только там, где значение расходится с расчётным.
 */
export const marketplaceBootstrapV17Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 17,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },

  async afterMigrate(ctx: ExtensionSchemaMigrationAfterContext): Promise<void> {
    const dataSource = ctx.resolve<DataSource>(
      getDataSourceToken('marketplace') as string | symbol
    );
    if (!dataSource) return;

    const legacy: Array<{ column_name: string }> = await dataSource.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_name = 'marketplace_container_type'
          AND column_name IN ('length_mm', 'width_mm', 'height_mm')`
    );

    if (legacy.length === 3) {
      await dataSource.query(
        `UPDATE marketplace_container_type
            SET length_cm = length_mm,
                width_cm = width_mm,
                height_cm = height_mm
          WHERE length_cm = 0 OR width_cm = 0 OR height_cm = 0`
      );
      ctx.logInfo('Габариты тары перенесены из прежних колонок в сантиметры.');
    }

    const recomputed: Array<{ id: string }> = await dataSource.query(
      RECOMPUTE_CONTAINER_VOLUME_SQL
    );
    if (recomputed.length > 0) {
      ctx.logInfo(
        `Объём тары пересчитан из габаритов в сантиметрах; типов обновлено — ${recomputed.length}.`
      );
    }
  },
};
