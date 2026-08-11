import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type {
  ExtensionSchemaMigrationAfterContext,
  IExtensionSchemaMigration,
} from '~/domain/extension/services/extension-schema-migration.service';
import { IConfig } from '../types';
import { UX_CATEGORY_DISPLAY_NAME } from '../constants/marketplace-category.constants';

/**
 * Bootstrap-миграция v18 расширения `market` — название категории становится
 * уникальным во всём справочнике.
 *
 * Зачем: уникальность держалась одной проверкой в сервисе — он читал список и
 * сравнивал названия. Два одновременных запроса проходят такую проверку оба и
 * создают две категории с одним названием. Гарантию даёт только база.
 *
 * Уникальность **глобальная**, а не в пределах кооператива (решение заказчика
 * 2026-08-10): в индекс входят и baseline-категории, и кастомные категории всех
 * кооперативов. Сравнение без учёта регистра — «Овощи» и «овощи» это одно имя.
 *
 * Существующие дубли: индекс на них не встанет, поэтому лишние строки сначала
 * переименовываются — к названию добавляется номер («Овощи (2)»). Оставляем
 * строку с наименьшим id, она старшая. Переименование логируется: название
 * видно кооперативу, и поправить его он может сам.
 *
 * Идемпотентна: индекс создаётся через IF NOT EXISTS, переименование трогает
 * только строки, у которых название совпало с более ранним.
 */
export const marketplaceBootstrapV18Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 18,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },

  async afterMigrate(ctx: ExtensionSchemaMigrationAfterContext): Promise<void> {
    const dataSource = ctx.resolve<DataSource>(
      getDataSourceToken('marketplace') as string | symbol
    );
    if (!dataSource) return;

    const renamed: Array<{ id: number; display_name: string }> = await dataSource.query(
      `WITH ranked AS (
         SELECT id,
                display_name,
                row_number() OVER (
                  PARTITION BY lower(display_name) ORDER BY id
                ) AS rn
           FROM marketplace_category
       )
       UPDATE marketplace_category AS c
          SET display_name = c.display_name || ' (' || ranked.rn || ')'
         FROM ranked
        WHERE ranked.id = c.id
          AND ranked.rn > 1
       RETURNING c.id, c.display_name`
    );

    if (renamed.length > 0) {
      ctx.logInfo(
        `Названия категорий-дублей разведены перед установкой уникальности: ${renamed
          .map((r) => `#${r.id} → «${r.display_name}»`)
          .join(', ')}.`
      );
    }

    await dataSource.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${UX_CATEGORY_DISPLAY_NAME}
         ON marketplace_category (lower(display_name))`
    );
    ctx.logInfo('Название категории уникально во всём справочнике.');
  },
};
