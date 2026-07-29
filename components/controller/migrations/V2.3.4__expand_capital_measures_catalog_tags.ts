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
  tag: string;
};

/** Полный согласованный каталог (дубль DEFAULT_BLAGOROST_MEASURES без Nest). */
const SEEDS: readonly Seed[] = [
  { title: 'Подтягивания', unit: 'раз', series_mode: 'rate', wave_period: 'day', tag: 'personal' },
  { title: 'Отжимания', unit: 'раз', series_mode: 'rate', wave_period: 'day', tag: 'personal' },
  { title: 'Приседания', unit: 'раз', series_mode: 'rate', wave_period: 'day', tag: 'personal' },
  { title: 'Шаги', unit: 'шт.', series_mode: 'rate', wave_period: 'day', tag: 'personal' },
  { title: 'Бег / ходьба', unit: 'км', series_mode: 'rate', wave_period: 'day', tag: 'personal' },
  { title: 'Тренировки', unit: 'шт.', series_mode: 'rate', wave_period: 'week', tag: 'personal' },
  { title: 'Сон', unit: 'ч', series_mode: 'level', wave_period: 'day', tag: 'personal' },
  { title: 'Вес', unit: 'кг', series_mode: 'level', wave_period: 'week', tag: 'personal' },
  { title: 'Настроение', unit: 'балл', series_mode: 'level', wave_period: 'day', tag: 'personal' },
  { title: 'Энергия', unit: 'балл', series_mode: 'level', wave_period: 'day', tag: 'personal' },
  { title: 'Медитация', unit: 'мин', series_mode: 'rate', wave_period: 'day', tag: 'personal' },
  { title: 'Чтение', unit: 'стр.', series_mode: 'rate', wave_period: 'day', tag: 'personal' },

  { title: 'Новые пользователи', unit: 'чел.', series_mode: 'rate', wave_period: 'week', tag: 'product' },
  { title: 'Активные пользователи', unit: 'чел.', series_mode: 'level', wave_period: 'week', tag: 'product' },
  { title: 'Регистрации', unit: 'шт.', series_mode: 'rate', wave_period: 'week', tag: 'product' },
  { title: 'Удержанные (вернулись)', unit: 'чел.', series_mode: 'rate', wave_period: 'week', tag: 'product' },
  { title: 'Конверсия в действие', unit: '%', series_mode: 'level', wave_period: 'week', tag: 'product' },
  { title: 'Обращения', unit: 'шт.', series_mode: 'rate', wave_period: 'week', tag: 'product' },
  { title: 'Новые взносы', unit: 'шт.', series_mode: 'rate', wave_period: 'week', tag: 'product' },
  { title: 'Средний взнос', unit: '₽', series_mode: 'level', wave_period: 'week', tag: 'product' },

  { title: 'Посты', unit: 'шт.', series_mode: 'rate', wave_period: 'week', tag: 'content' },
  { title: 'Видео', unit: 'шт.', series_mode: 'rate', wave_period: 'week', tag: 'content' },
  { title: 'Рилсы', unit: 'шт.', series_mode: 'rate', wave_period: 'day', tag: 'content' },
  { title: 'Истории', unit: 'шт.', series_mode: 'rate', wave_period: 'day', tag: 'content' },
  { title: 'Подкасты', unit: 'шт.', series_mode: 'rate', wave_period: 'week', tag: 'content' },
  { title: 'Рассылки', unit: 'шт.', series_mode: 'rate', wave_period: 'week', tag: 'content' },
  { title: 'Просмотры', unit: 'шт.', series_mode: 'rate', wave_period: 'day', tag: 'content' },
  { title: 'Охват', unit: 'чел.', series_mode: 'rate', wave_period: 'day', tag: 'content' },
  { title: 'Лайки', unit: 'шт.', series_mode: 'rate', wave_period: 'day', tag: 'content' },
  { title: 'Комментарии', unit: 'шт.', series_mode: 'rate', wave_period: 'day', tag: 'content' },
  { title: 'Репосты', unit: 'шт.', series_mode: 'rate', wave_period: 'day', tag: 'content' },
  { title: 'Подписчики', unit: 'чел.', series_mode: 'level', wave_period: 'week', tag: 'content' },

  { title: 'Новые пайщики', unit: 'чел.', series_mode: 'rate', wave_period: 'week', tag: 'cooperative' },
  { title: 'Активные пайщики', unit: 'чел.', series_mode: 'level', wave_period: 'week', tag: 'cooperative' },
  { title: 'Предложения', unit: 'шт.', series_mode: 'rate', wave_period: 'week', tag: 'cooperative' },
  { title: 'Закрытые задачи', unit: 'шт.', series_mode: 'rate', wave_period: 'week', tag: 'cooperative' },

  { title: 'Баги', unit: 'шт.', series_mode: 'rate', wave_period: 'week', tag: 'quality' },
  { title: 'Инциденты', unit: 'шт.', series_mode: 'rate', wave_period: 'week', tag: 'quality' },
  { title: 'Закрытые инциденты', unit: 'шт.', series_mode: 'rate', wave_period: 'week', tag: 'quality' },
  { title: 'NPS', unit: 'балл', series_mode: 'level', wave_period: 'month', tag: 'quality' },
  { title: 'CSI', unit: 'балл', series_mode: 'level', wave_period: 'month', tag: 'quality' },
  { title: 'Время ответа', unit: 'ч', series_mode: 'level', wave_period: 'week', tag: 'quality' },
];

function defaultMeasureHash(coopname: string, title: string, unit: string): string {
  return createHash('sha256')
    .update(`capital-measure:v1:${coopname}:${title}:${unit}`)
    .digest('hex');
}

/**
 * Расширение справочника мер + колонка tag.
 * Идемпотентно: insert недостающих; update series_mode/wave_period/tag у совпавших.
 */
export default {
  name: 'expand capital_measures catalog with tags',

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
        logger.warn('capital_measures ещё нет — сид пропущен');
        return true;
      }

      const waveCols: Array<{ exists: boolean }> = await dataSource.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'capital_measures'
            AND column_name = 'wave_period'
        ) AS exists
      `);
      if (!waveCols[0]?.exists) {
        await dataSource.query(`
          ALTER TABLE capital_measures
          ADD COLUMN wave_period varchar NOT NULL DEFAULT 'day'
        `);
        logger.info('Добавлена колонка capital_measures.wave_period');
      }

      const tagCols: Array<{ exists: boolean }> = await dataSource.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'capital_measures'
            AND column_name = 'tag'
        ) AS exists
      `);
      if (!tagCols[0]?.exists) {
        await dataSource.query(`
          ALTER TABLE capital_measures
          ADD COLUMN tag varchar NOT NULL DEFAULT 'product'
        `);
        logger.info('Добавлена колонка capital_measures.tag');
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
            SET series_mode = $1, wave_period = $2, tag = $3, _updated_at = NOW()
            WHERE measure_hash = $4
            `,
            [seed.series_mode, seed.wave_period, seed.tag, existing[0].measure_hash]
          );
          updated += 1;
          continue;
        }

        const measureHash = defaultMeasureHash(coopname, seed.title, seed.unit);
        await dataSource.query(
          `
          INSERT INTO capital_measures (
            _id, measure_hash, coopname, title, unit,
            series_mode, wave_period, tag, created_by, status,
            block_num, present, _created_at, _updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, 'system', 'active',
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
            seed.tag,
          ]
        );
        inserted += 1;
      }

      logger.info(`Каталог мер Благороста для ${coopname}: +${inserted} / ~${updated}`);
      return true;
    } catch (error) {
      logger.error(
        `Ошибка сида capital_measures (V2.3.4): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  },
};
