import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type {
  ExtensionSchemaMigrationAfterContext,
  IExtensionSchemaMigration,
} from '@coopenomics/extension-kit';
import { IConfig } from '../types';

/**
 * Пересчёт объёма тары из габаритов. Габариты — первоисточник, объём от них
 * производная, поэтому пересчитываем БЕЗУСЛОВНО.
 *
 * Условие «только там, где ноль» было бы ошибкой: при переименовании колонки
 * старое значение может уцелеть, и тогда литры молча останутся лежать в поле
 * кубометров — расхождение в тысячу раз, которое никто не заметит глазами
 * (0,3 вместо 0,0003).
 */
export const RECOMPUTE_CONTAINER_VOLUME_SQL = `
  UPDATE marketplace_container_type
     SET volume_m3 = ROUND(
           (length_cm::numeric * width_cm::numeric * height_cm::numeric) / 1000000,
           4
         )
   WHERE volume_m3 IS DISTINCT FROM ROUND(
           (length_cm::numeric * width_cm::numeric * height_cm::numeric) / 1000000,
           4
         )
   RETURNING id`;

/**
 * Bootstrap-миграция v15 расширения `market` — объём тары переезжает с литров
 * на кубометры (Эпик 19).
 *
 * Зачем: объём боксов нужен ровно для одного — прикинуть, какая машина увезёт
 * партию между кооперативными участками. Перевозку считают кубами («нужно 10
 * кубов»), а не литрами, и переводить одно в другое в уме на погрузке никто не
 * станет.
 *
 * Изменение схемы (исполняет TypeORM `synchronize:true` по декларации
 * сущности): колонка `volume_liters` уступает место `volume_m3`. Новая колонка
 * объявлена с `default 0`, иначе добавить NOT NULL поле на непустую таблицу не
 * получится.
 *
 * Перенос данных (эта миграция): объём пересчитывается из габаритов, которые
 * никуда не делись. Пересчёт, а не деление старого значения на тысячу, потому
 * что габариты — первоисточник, а прежний объём мог быть введён руками.
 *
 * Идемпотентна: обновляются только строки, где хранимое значение расходится с
 * расчётным.
 *
 * Конфиг расширения не меняется — `migrate` тождественный.
 */
export const marketplaceBootstrapV15Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 15,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },

  async afterMigrate(ctx: ExtensionSchemaMigrationAfterContext): Promise<void> {
    // getDataSourceToken отдаёт union (string | Function | Type<DataSource>);
    // для DI-резолва достаточно строкового/символьного варианта.
    const dataSource = ctx.resolve<DataSource>(
      getDataSourceToken('marketplace') as string | symbol
    );
    if (!dataSource) return;

    const result: Array<{ id: string }> = await dataSource.query(
      RECOMPUTE_CONTAINER_VOLUME_SQL
    );

    if (result.length > 0) {
      ctx.logInfo(
        `Объём тары пересчитан из габаритов в кубометры; типов обновлено — ${result.length}.`
      );
    }
  },
};
