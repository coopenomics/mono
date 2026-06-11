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
      // V2.4.0 init создал плейсхолдер access_rules со старой схемой (role/action/subject)
      // без колонки subject_type. На такой БД `CREATE TABLE IF NOT EXISTS` ниже = no-op,
      // а индекс по subject_type упал бы. Сносим пустой плейсхолдер (Layer 2 ещё ниоткуда
      // не пишется → DROP безопасен). Идемпотентно: при правильной схеме DROP не выполняется.
      await db.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'access_rules'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'access_rules' AND column_name = 'subject_type'
          ) THEN
            DROP TABLE access_rules;
            RAISE NOTICE 'access_rules: снесён плейсхолдер V2.4.0';
          END IF;
        END $$;
      `);
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
