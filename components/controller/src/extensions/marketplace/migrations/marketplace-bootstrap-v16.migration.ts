import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type {
  ExtensionSchemaMigrationAfterContext,
  IExtensionSchemaMigration,
} from '~/domain/extension/services/extension-schema-migration.service';
import { IConfig } from '../types';
import { RECOMPUTE_CONTAINER_VOLUME_SQL } from './marketplace-bootstrap-v15.migration';

/**
 * Bootstrap-миграция v16 расширения `market` — починка объёма тары после v15.
 *
 * Первая редакция v15 пересчитывала объём только там, где он равен нулю: она
 * исходила из того, что новая колонка `volume_m3` создаётся пустой. На деле при
 * смене колонки старое значение может уцелеть — и тогда в поле кубометров молча
 * остаются литры. Расхождение в тысячу раз, которое глазами не поймать: у
 * коробки 100×100×30 мм вместо «0,0003 м³» стоит «0,3 м³», а это уже размер
 * стиральной машины. Ошиблись бы ровно там, ради чего объём и заводили, — при
 * подборе машины под перевозку.
 *
 * Само условие в v15 исправлено на безусловный пересчёт, но там, где она уже
 * отработала, версия расширения поднята и повторно v15 не запустится. Поэтому
 * тот же пересчёт выполняется отдельной версией.
 *
 * Схему не меняет, конфиг не трогает, идемпотентна — обновляются только строки,
 * где хранимое значение расходится с расчётным.
 */
export const marketplaceBootstrapV16Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 16,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },

  async afterMigrate(ctx: ExtensionSchemaMigrationAfterContext): Promise<void> {
    const dataSource = ctx.resolve<DataSource>(
      getDataSourceToken('marketplace') as string | symbol
    );
    if (!dataSource) return;

    const result: Array<{ id: string }> = await dataSource.query(
      RECOMPUTE_CONTAINER_VOLUME_SQL
    );

    if (result.length > 0) {
      ctx.logWarn(
        `Объём тары расходился с габаритами и пересчитан заново; типов исправлено — ${result.length}.`
      );
    }
  },
};
