import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID Story 4.6: настройки кооператива в coop_domain_db (таблица `coop_settings`).
 * Singleton-строка (`id = 1`) — coop_domain_db обслуживает один кооператив, поэтому
 * глобальные настройки = одна запись; новые настройки добавляются колонками.
 * `cert_ttl_seconds` — срок жизни participant_certificate (default 3600 = 1ч);
 * короткий TTL ограничивает окно атаки при компрометации ключа (Story 4.6 AC).
 */
export default {
  name: 'coopid: coop_settings',

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
        CREATE TABLE IF NOT EXISTS coop_settings (
          id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
          cert_ttl_seconds integer NOT NULL DEFAULT 3600,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await db.query(`INSERT INTO coop_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
      logger.info('coop_settings создана');
      return true;
    } catch (e) {
      logger.error(`coop_settings migration failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.6 не реализован.');
    return false;
  },
};
