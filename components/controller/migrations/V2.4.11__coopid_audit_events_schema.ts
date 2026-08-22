import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID Story 8.1: audit_events schema (append-only + помесячные партиции + триггеры +
 * GRANT) уже создан в V2.4.0. Эта миграция закрывает остаток AC, отложенный тогда:
 *  - колонка `user_agent` (форензика, наполняет 8.2);
 *  - выделенная read-only роль `coop_audit_reader` (AC: INSERT приложению, SELECT читателю
 *    аудита) — в V2.4.0 разделение ролей было отложено в prod-плейбук;
 *  - форвард-роллинг партиций на текущий+2 месяца (идемпотентно);
 *  - re-assert append-only грантов приложению.
 * Имена колонок event/context/created_at сохранены намеренно (боевая партиционированная
 * append-only таблица, ~30 точек записи) — семантически = AC action/metadata/timestamp.
 */
export default {
  name: 'coopid: audit_events user_agent + coop_audit_reader role',

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

      // 1. user_agent — AC явно перечисляет в структуре; nullable (backfill невозможен).
      await db.query(`ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS user_agent text;`);

      // 2. coop_audit_reader (NOLOGIN group-role) — SELECT-only для читателя аудита.
      //    Создание под insufficient_privilege-страховкой: в рестриктед prod без CREATEROLE
      //    роль заведёт плейбук, миграция не падает (как и декларация грантов в V2.4.0).
      await db.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'coop_audit_reader') THEN
            BEGIN
              CREATE ROLE coop_audit_reader NOLOGIN;
            EXCEPTION WHEN insufficient_privilege THEN
              RAISE NOTICE 'coop_audit_reader не создан: нет CREATEROLE; роль заведёт prod-playbook';
            END;
          END IF;
        END $$;
      `);
      await db.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'coop_audit_reader') THEN
            EXECUTE 'GRANT SELECT ON audit_events TO coop_audit_reader';
          END IF;
        END $$;
      `);

      // 3. Форвард-роллинг партиций: текущий + следующие 2 месяца (идемпотентно).
      await db.query(`
        DO $$
        DECLARE
          m date;
          m_next date;
          i int;
        BEGIN
          FOR i IN 0..2 LOOP
            m := (date_trunc('month', now()) + (i || ' month')::interval)::date;
            m_next := (date_trunc('month', now()) + ((i + 1) || ' month')::interval)::date;
            EXECUTE format(
              'CREATE TABLE IF NOT EXISTS audit_events_%s PARTITION OF audit_events FOR VALUES FROM (%L) TO (%L)',
              to_char(m, 'YYYY_MM'), m, m_next);
          END LOOP;
        END $$;
      `);

      // 4. Re-assert append-only грантов приложению (идемпотентно; имя роли валидируем —
      //    идентификатор в DDL, биндинг невозможен).
      const role = config.coopDomainDb.username;
      if (!/^[a-z_][a-z0-9_]*$/.test(role))
        throw new Error(`Недопустимое имя роли COOP_DOMAIN_DB_USERNAME: ${role}`);
      await db.query(`
        REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM ${role};
        GRANT INSERT, SELECT ON audit_events TO ${role};
      `);

      logger.info('audit_events: user_agent добавлен, coop_audit_reader + партиции + гранты выровнены');
      return true;
    } catch (e) {
      logger.error(`audit_events schema migration failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.11 не реализован: audit_events append-only, дроп колонки/роли — только вручную.');
    return false;
  },
};
