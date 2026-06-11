import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID Story 4.2: per-coop правила применения типов верификации. Таблица
 * `verification_rules` в coop_domain_db — одна запись на действие (action_code =
 * открытый идентификатор, PRIMARY KEY). `required_types` — обязательные типы
 * верификации (`text[]`). Отсутствие записи = действие без ограничений по верификации.
 */
export default {
  name: 'coopid: verification_rules',

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
        CREATE TABLE IF NOT EXISTS verification_rules (
          action_code text PRIMARY KEY,
          required_types text[] NOT NULL DEFAULT '{}',
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      logger.info('verification_rules создана');
      return true;
    } catch (e) {
      logger.error(`verification_rules migration failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.5 не реализован.');
    return false;
  },
};
