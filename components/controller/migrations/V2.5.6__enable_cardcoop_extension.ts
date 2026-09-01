import type { DataSource } from 'typeorm';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

/**
 * Расширение «Карта пайщика» включается у уже установленных кооперативов (3B5-65).
 *
 * В реестре оно теперь стоит в составе по умолчанию и включённым — как стол совета: карта
 * пайщика часть членства, а не дополнение к нему. Но состав по умолчанию доливается только
 * тем, у кого записи ещё нет, и кооперативы, успевшие получить расширение выключенным,
 * остались бы с ним выключенным навсегда: включить его могла бы только рука председателя.
 *
 * Отдельная миграция, а не «включать всё, что в реестре по умолчанию включено, при каждом
 * старте»: последнее переоткрывало бы расширение, которое кооператив намеренно выключил.
 * Здесь однократный переход состояния, и он виден в истории.
 *
 * Кооперативы основной сети это не затрагивает: туда расширение не попадает по доступности
 * (`NON_MAINNET_ONLY`), а значит и записи о нём там нет.
 */
export default {
  name: 'enable cardcoop extension',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    try {
      const updated = (await qr.query(
        `UPDATE extensions SET enabled = true WHERE name = 'cardcoop' AND enabled = false RETURNING name`
      )) as unknown[];

      logger.info(
        updated.length > 0
          ? 'Расширение «Карта пайщика» включено у кооператива'
          : 'Расширение «Карта пайщика» уже включено либо ещё не установлено — ничего не менялось'
      );
      return true;
    } catch (error) {
      logger.error(`enable cardcoop extension failed: ${(error as Error).message}`);
      throw error;
    } finally {
      await qr.release();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    // Обратно не выключаем: кооператив мог включить его и сам, и отличить одно от другого
    // здесь нечем — выключение снесло бы осознанный выбор председателя.
    logger.info('enable cardcoop extension: down — ничего не делаем');
    return true;
  },
};
