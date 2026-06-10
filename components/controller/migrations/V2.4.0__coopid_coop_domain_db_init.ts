import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID Story 1.4: начальные схемы coop_domain_db (отдельная БД в coop-postgres,
 * Story 1.1). Миграция открывает СОБСТВЕННОЕ подключение из config.coopDomainDb —
 * главный dataSource (voskhod) не используется и не передаётся дальше.
 *
 * Таблицы:
 *  - vaults                — зашифрованные блобы (subject_type-discriminated);
 *  - audit_events          — append-only журнал: месячные партиции + DEFAULT,
 *                            триггер запрещает UPDATE/DELETE даже владельцу;
 *  - chain_manifests_cache — TTL-aware кеш authority из COOPOS;
 *  - legacy_user_mapping   — UUID ↔ Mongo ObjectID на миграционный период;
 *  - access_rules          — декларативная матрица CASL Layer 2 (семантика — Story 6.2).
 */
export default {
  name: 'coopid: init coop_domain_db (vaults, audit_events, chain cache, mapping, access_rules)',

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
        CREATE TABLE IF NOT EXISTS vaults (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          subject_type text NOT NULL CHECK (subject_type IN ('participant', 'coop', 'council_action')),
          subject_id text NOT NULL,
          cipher_version smallint NOT NULL DEFAULT 1,
          kdf_version smallint NOT NULL DEFAULT 1,
          salt bytea NOT NULL,
          nonce bytea NOT NULL,
          ciphertext bytea NOT NULL,
          auth_tag bytea NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT vaults_subject_uq UNIQUE (subject_type, subject_id)
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS audit_events (
          id bigint GENERATED ALWAYS AS IDENTITY,
          event text NOT NULL,
          subject_id text,
          actor text,
          result text NOT NULL CHECK (result IN ('success', 'failure', 'degraded')),
          context jsonb NOT NULL DEFAULT '{}'::jsonb,
          ip inet,
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (id, created_at)
        ) PARTITION BY RANGE (created_at);
      `);

      // Партиции: текущий месяц, следующий и DEFAULT-страховка (создание
      // последующих помесячных — забота operational runbook, Stories 9.8/9.10).
      await db.query(`
        DO $$
        DECLARE
          m0 date := date_trunc('month', now())::date;
          m1 date := (date_trunc('month', now()) + interval '1 month')::date;
          m2 date := (date_trunc('month', now()) + interval '2 month')::date;
        BEGIN
          EXECUTE format(
            'CREATE TABLE IF NOT EXISTS audit_events_%s PARTITION OF audit_events FOR VALUES FROM (%L) TO (%L)',
            to_char(m0, 'YYYY_MM'), m0, m1);
          EXECUTE format(
            'CREATE TABLE IF NOT EXISTS audit_events_%s PARTITION OF audit_events FOR VALUES FROM (%L) TO (%L)',
            to_char(m1, 'YYYY_MM'), m1, m2);
          EXECUTE 'CREATE TABLE IF NOT EXISTS audit_events_default PARTITION OF audit_events DEFAULT';
        END $$;
      `);

      // Append-only: триггер держит инвариант даже для владельца таблицы
      // (GRANT/REVOKE ниже — декларация, заработает буквально при отдельной
      // migration-роли из prod-плейбука).
      await db.query(`
        CREATE OR REPLACE FUNCTION audit_events_append_only() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'audit_events is append-only: % is forbidden', TG_OP;
        END;
        $$ LANGUAGE plpgsql;
      `);
      await db.query(`
        DROP TRIGGER IF EXISTS audit_events_no_update_delete ON audit_events;
        CREATE TRIGGER audit_events_no_update_delete
          BEFORE UPDATE OR DELETE ON audit_events
          FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();
      `);
      // ROW-триггер не ловит TRUNCATE — закрываем statement-триггером.
      await db.query(`
        DROP TRIGGER IF EXISTS audit_events_no_truncate ON audit_events;
        CREATE TRIGGER audit_events_no_truncate
          BEFORE TRUNCATE ON audit_events
          FOR EACH STATEMENT EXECUTE FUNCTION audit_events_append_only();
      `);
      // username — идентификатор в DDL, биндинг невозможен: валидируем строго.
      const role = config.coopDomainDb.username;
      if (!/^[a-z_][a-z0-9_]*$/.test(role))
        throw new Error(`Недопустимое имя роли COOP_DOMAIN_DB_USERNAME: ${role}`);
      await db.query(`
        REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM ${role};
        GRANT INSERT, SELECT ON audit_events TO ${role};
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS chain_manifests_cache (
          account text PRIMARY KEY,
          manifest jsonb NOT NULL,
          fetched_at timestamptz NOT NULL DEFAULT now(),
          expires_at timestamptz NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS legacy_user_mapping (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          mongo_object_id text NOT NULL UNIQUE,
          username text NOT NULL UNIQUE,
          auth_version text NOT NULL DEFAULT 'legacy' CHECK (auth_version IN ('legacy', 'oidc', 'dual')),
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS access_rules (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          role text NOT NULL,
          action text NOT NULL,
          subject text NOT NULL,
          conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT access_rules_uq UNIQUE (role, action, subject)
        );
      `);

      await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_events_subject ON audit_events (subject_id, created_at);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_audit_events_event ON audit_events (event, created_at);`);

      logger.info('coop_domain_db: vaults, audit_events(+партиции, append-only), chain_manifests_cache, legacy_user_mapping, access_rules — готовы');
      return true;
    } catch (e) {
      logger.error(`coop_domain_db init failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.0 не реализован намеренно: audit_events append-only, удаление схем — только вручную.');
    return false;
  },
};
