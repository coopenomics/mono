import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * Таблица `pending_critical_actions` удаляется из coop_domain_db.
 *
 * Заготовка критических действий совета (две подписи) убрана с сервера
 * 02.10.2026: ею никто не пользовался, проведённое действие ничего не
 * исполняло. Кода, который читает или пишет таблицу, больше нет. Число строк
 * перед удалением пишется в журнал; сведения о проведённых действиях остаются
 * в журнале аудита.
 */
export default {
  name: 'coopid: drop pending_critical_actions',

  async up({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    const db = new DataSource({
      type: 'postgres',
      host: config.coopDomainDb.host,
      port: config.coopDomainDb.port,
      username: config.coopDomainDb.username,
      password: config.coopDomainDb.password,
      database: config.coopDomainDb.database,
    });
    try {
      await db.initialize();
      const [{ exists }] = await db.query(`SELECT to_regclass('pending_critical_actions') IS NOT NULL AS exists`);
      if (!exists) {
        logger.info('pending_critical_actions уже нет');
        return true;
      }
      const [{ count }] = await db.query(`SELECT count(*)::int AS count FROM pending_critical_actions`);
      await db.query(`DROP TABLE pending_critical_actions`);
      logger.info(`pending_critical_actions удалена (строк было: ${count})`);
      return true;
    } catch (e) {
      logger.error(`drop pending_critical_actions failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат 202610030550 не реализован: заготовка критических действий убрана с сервера.');
    return false;
  },
};
