import { createHash, randomUUID } from 'crypto';
import type { DataSource } from 'typeorm';
import config from '~/config/config';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

type Seed = {
  title: string;
  unit: string;
  series_mode: string;
  wave_period: string;
};

/** Дублирует DEFAULT_BLAGOROST_MEASURES — миграции без зависимости от Nest enum register. */
const SEEDS: readonly Seed[] = [
  { title: 'Подтягивания', unit: 'раз', series_mode: 'rate', wave_period: 'day' },
  { title: 'Вес', unit: 'кг', series_mode: 'level', wave_period: 'week' },
  { title: 'Настроение', unit: 'балл', series_mode: 'level', wave_period: 'day' },
  { title: 'Новые пользователи', unit: 'чел.', series_mode: 'rate', wave_period: 'week' },
  { title: 'Посты', unit: 'шт.', series_mode: 'rate', wave_period: 'week' },
  { title: 'Видео', unit: 'шт.', series_mode: 'rate', wave_period: 'week' },
  { title: 'Рилсы', unit: 'шт.', series_mode: 'rate', wave_period: 'day' },
  { title: 'Истории', unit: 'шт.', series_mode: 'rate', wave_period: 'day' },
];

function defaultMeasureHash(coopname: string, title: string, unit: string): string {
  return createHash('sha256')
    .update(`capital-measure:v1:${coopname}:${title}:${unit}`)
    .digest('hex');
}

/**
 * Сид справочника мер Благороста (волна + режим ряда) для coopname из конфига.
 * Идемпотентно: insert если нет пары title+unit; иначе выравнивает series_mode/wave_period.
 */
export default {
  name: 'seed capital_measures default blagorost catalog with wave_period',

  async up({
    dataSource,
    logger,
  }: {
    dataSource: DataSource;
    logger: MigrationLogger;
  }): Promise<boolean> {
    try {
      const tables: Array<{ exists: boolean }> = await dataSource.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'capital_measures'
        ) AS exists
      `);
      if (!tables[0]?.exists) {
        logger.warn(
          'capital_measures ещё нет — сид пропущен (создаст TypeORM sync + ensureDefaultMeasures)'
        );
        return true;
      }

      const cols: Array<{ exists: boolean }> = await dataSource.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'capital_measures'
            AND column_name = 'wave_period'
        ) AS exists
      `);
      if (!cols[0]?.exists) {
        await dataSource.query(`
          ALTER TABLE capital_measures
          ADD COLUMN wave_period varchar NOT NULL DEFAULT 'day'
        `);
        logger.info('Добавлена колонка capital_measures.wave_period');
      }

      const coopname = config.coopname;
      if (!coopname) {
        logger.warn('COOPNAME пуст — сид мер пропущен');
        return true;
      }

      let inserted = 0;
      let updated = 0;

      for (const seed of SEEDS) {
        const existing: Array<{ measure_hash: string }> = await dataSource.query(
          `
          SELECT measure_hash FROM capital_measures
          WHERE coopname = $1 AND title = $2 AND unit = $3 AND status = 'active'
          LIMIT 1
          `,
          [coopname, seed.title, seed.unit]
        );

        if (existing.length > 0) {
          await dataSource.query(
            `
            UPDATE capital_measures
            SET series_mode = $1, wave_period = $2, _updated_at = NOW()
            WHERE measure_hash = $3
            `,
            [seed.series_mode, seed.wave_period, existing[0].measure_hash]
          );
          updated += 1;
          continue;
        }

        const measureHash = defaultMeasureHash(coopname, seed.title, seed.unit);
        await dataSource.query(
          `
          INSERT INTO capital_measures (
            _id, measure_hash, coopname, title, unit,
            series_mode, wave_period, created_by, status,
            block_num, present, _created_at, _updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, 'system', 'active',
            0, false, NOW(), NOW()
          )
          ON CONFLICT (measure_hash) DO NOTHING
          `,
          [
            randomUUID(),
            measureHash,
            coopname,
            seed.title,
            seed.unit,
            seed.series_mode,
            seed.wave_period,
          ]
        );
        inserted += 1;
      }

      logger.info(`Справочник мер Благороста для ${coopname}: +${inserted} / ~${updated}`);
      return true;
    } catch (error) {
      logger.error(
        `Ошибка сида capital_measures: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  },
};
