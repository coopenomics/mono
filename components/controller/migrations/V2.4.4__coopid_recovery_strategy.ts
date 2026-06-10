import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID Story 3.5: стратегия восстановления пайщика. Таблица `recovery_strategy`
 * в coop_domain_db — одна запись на пайщика (subject_id = user.id). `strategy` —
 * один из email_magic_link|offline_code|council; отсутствие записи = дефолт
 * email_magic_link (обратная совместимость с 3.1).
 */
export default {
  name: 'coopid: recovery_strategy',

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
      await db.query(`
        CREATE TABLE IF NOT EXISTS recovery_strategy (
          subject_id text PRIMARY KEY,
          strategy text NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      logger.info('recovery_strategy создана');
      return true;
    } catch (e) {
      logger.error(`recovery_strategy migration failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.4 не реализован.');
    return false;
  },
};
