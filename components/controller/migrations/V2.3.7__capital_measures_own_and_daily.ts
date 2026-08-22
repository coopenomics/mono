import type { DataSource } from 'typeorm';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

/**
 * Меры перестали быть общим справочником: их заводит сам кооператив,
 * вводя название и единицу текстом при планировании компонента.
 *
 * - Сид-меры Благороста (created_by = 'system'), которые никто не взял в цель,
 *   удаляем — в списке кооператива должны остаться только свои.
 *   Взятые в цель сохраняем: иначе цель осиротеет и упадёт чтение метрик.
 * - Таймфрейм один — день, поэтому колонка wave_period больше не нужна.
 * - Категория справочника (tag) уходит вместе со справочником.
 */
export default {
  name: 'capital measures own and daily',

  async up({
    dataSource,
    logger,
  }: {
    dataSource: DataSource;
    logger: MigrationLogger;
  }): Promise<boolean> {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const removed: Array<{ measure_hash: string }> = await qr.query(`
        DELETE FROM capital_measures m
        WHERE m.created_by = 'system'
          AND NOT EXISTS (
            SELECT 1 FROM capital_component_metrics cm
            WHERE lower(cm.measure_hash) = lower(m.measure_hash)
          )
        RETURNING m.measure_hash
      `);
      logger.info(`Удалено неиспользуемых мер общего справочника: ${removed.length}`);

      await qr.query(`DROP INDEX IF EXISTS idx_capital_measures_tag`);
      await qr.query(`ALTER TABLE capital_measures DROP COLUMN IF EXISTS wave_period`);
      await qr.query(`ALTER TABLE capital_measures DROP COLUMN IF EXISTS tag`);

      await qr.commitTransaction();
      logger.info('capital_measures: wave_period и tag убраны, ряд считается по дням');
      return true;
    } catch (e) {
      await qr.rollbackTransaction();
      logger.error(`V2.3.7 failed: ${(e as Error).message}`);
      throw e;
    } finally {
      await qr.release();
    }
  },
};
