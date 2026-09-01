import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID Story 6.3: реконсиляция таблицы `access_rules`. В init-миграции V2.4.0
 * `access_rules` была создана плейсхолдером со старой схемой (`role/action/subject/
 * conditions`), а Story 6.2 (V2.4.7) добавила правильную схему через
 * `CREATE TABLE IF NOT EXISTS` — но на любой БД, где V2.4.0 отработала раньше, V2.4.7
 * становилась no-op, и таблица оставалась со старой схемой. Из-за этого репозиторий
 * Layer 2 (`PostgresAccessRulesRepository`, колонки `subject_type/subject_id/effect/
 * resource_type/expires_at`) упал бы в рантайме на `column "subject_type" does not exist`.
 *
 * Фикс forward-миграцией (канон append-only, без правки применённых V2.4.0/V2.4.7):
 * если таблица существует, но без колонки `subject_type` (= старый плейсхолдер) —
 * пересоздаём с правильной схемой. Данных в плейсхолдере нет (CoopID не в проде,
 * Layer 2 ни из какого UI ещё не пишет), поэтому DROP безопасен. Идемпотентно:
 * на БД с уже правильной схемой DROP не выполняется, CREATE IF NOT EXISTS — no-op.
 */
export default {
  name: 'coopid: reconcile access_rules schema (Layer 2)',

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
      // Старый плейсхолдер из V2.4.0 (нет колонки subject_type) — снести.
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
      // Правильная схема Layer 2 (идентична V2.4.7 — единый источник).
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
      logger.info('access_rules: схема Layer 2 реконсилирована');
      return true;
    } catch (e) {
      logger.error(`access_rules reconcile failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.8 не реализован: реконсиляция схемы необратима без потери данных.');
    return false;
  },
};
