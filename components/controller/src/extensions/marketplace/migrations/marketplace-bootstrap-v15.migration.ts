import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type {
  ExtensionSchemaMigrationAfterContext,
  IExtensionSchemaMigration,
} from '~/domain/extension/services/extension-schema-migration.service';
import { IConfig } from '../types';

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
 * Идемпотентна: трогает только строки с нулевым объёмом.
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
      `UPDATE marketplace_container_type
          SET volume_m3 = ROUND(
                (length_mm::numeric * width_mm::numeric * height_mm::numeric) / 1000000000,
                4
              )
        WHERE volume_m3 IS NULL OR volume_m3 = 0
        RETURNING id`
    );

    if (result.length > 0) {
      ctx.logInfo(
        `Объём тары пересчитан из габаритов в кубометры; типов обновлено — ${result.length}.`
      );
    }
  },
};
