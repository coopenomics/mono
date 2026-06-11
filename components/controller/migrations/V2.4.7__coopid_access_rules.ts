import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID Story 6.2: CASL Layer 2 — декларативные точечные права. Таблица
 * `access_rules` в coop_domain_db: правило навешивается на роль (`subject_type='role'`,
 * `subject_id` = имя core-роли) либо на конкретного пайщика (`subject_type='participant'`,
 * `subject_id` = username). `effect` allow/deny, `action`/`resource_type` — CASL-словарь,
 * `conditions` — CASL-условия (jsonb). `expires_at` — TTL точечных capabilities (Story 6.7).
 */
export default {
  name: 'coopid: access_rules',

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
        CREATE TABLE IF NOT EXISTS access_rules (
          id bigserial PRIMARY KEY,
          subject_type text NOT NULL,
          subject_id text NOT NULL,
          effect text NOT NULL DEFAULT 'allow',
          action text NOT NULL,
          resource_type text NOT NULL,
          conditions jsonb,
          expires_at timestamptz,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_access_rules_principal ON access_rules (subject_type, subject_id);`);
      logger.info('access_rules создана');
      return true;
    } catch (e) {
      logger.error(`access_rules migration failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.7 не реализован.');
    return false;
  },
};
