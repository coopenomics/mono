import type { DataSource } from 'typeorm';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * Epic 2 Story 2.1: таблицы для хранения истории сгенерированных XML-отчётов
 * ФНС/ФСС и ручных корректировок балансов прошлых периодов.
 *
 * Идемпотентна: CREATE TABLE IF NOT EXISTS + проверка индексов через
 * pg_indexes. При `synchronize: true` TypeORM сам создаёт таблицы из
 * entity-деклараций, но явная миграция гарантирует корректный deploy,
 * если `synchronize` будет отключён.
 */
export default {
  name: 'Создание generated_reports и balance_corrections',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    try {
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS "generated_reports" (
          "id"                     uuid NOT NULL DEFAULT uuid_generate_v4(),
          "coopname"               varchar(64)  NOT NULL,
          "report_type"            varchar(32)  NOT NULL,
          "year"                   int          NOT NULL,
          "period"                 int          NULL,
          "xml"                    text         NOT NULL,
          "file_name"              varchar(255) NOT NULL,
          "is_valid"               boolean      NOT NULL DEFAULT false,
          "validation_errors"      jsonb        NULL,
          "organization_snapshot"  jsonb        NOT NULL,
          "corrections_snapshot"   jsonb        NULL,
          "generated_by"           varchar(255) NOT NULL,
          "created_at"             timestamptz  NOT NULL DEFAULT now(),
          CONSTRAINT "pk_generated_reports" PRIMARY KEY ("id")
        )
      `);

      await dataSource.query(`CREATE INDEX IF NOT EXISTS "ix_generated_reports_coopname" ON "generated_reports" ("coopname")`);
      await dataSource.query(`CREATE INDEX IF NOT EXISTS "ix_generated_reports_filter" ON "generated_reports" ("coopname", "report_type", "year", "period")`);
      await dataSource.query(`CREATE INDEX IF NOT EXISTS "ix_generated_reports_coop_created" ON "generated_reports" ("coopname", "created_at")`);
      await dataSource.query(`CREATE INDEX IF NOT EXISTS "ix_generated_reports_type_created" ON "generated_reports" ("report_type", "created_at")`);

      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS "balance_corrections" (
          "id"                     uuid NOT NULL DEFAULT uuid_generate_v4(),
          "coopname"               varchar(64)  NOT NULL,
          "year"                   int          NOT NULL,
          "account_display_id"     varchar(20)  NOT NULL,
          "balance_previous"       numeric(20,2) NOT NULL DEFAULT 0,
          "balance_pre_previous"   numeric(20,2) NOT NULL DEFAULT 0,
          "updated_by"             varchar(255) NOT NULL,
          "updated_at"             timestamptz  NOT NULL DEFAULT now(),
          CONSTRAINT "pk_balance_corrections" PRIMARY KEY ("id"),
          CONSTRAINT "uq_balance_corrections_coop_year_account" UNIQUE ("coopname", "year", "account_display_id")
        )
      `);

      await dataSource.query(`CREATE INDEX IF NOT EXISTS "ix_balance_corrections_coop_year" ON "balance_corrections" ("coopname", "year")`);

      logger.info('generated_reports и balance_corrections созданы (или уже существовали).');
      return true;
    } catch (e) {
      logger.error(`Ошибка миграции V2.0.0 (reports-tables): ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  },

  async down({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    try {
      await dataSource.query(`DROP TABLE IF EXISTS "balance_corrections"`);
      await dataSource.query(`DROP TABLE IF EXISTS "generated_reports"`);
      logger.warn('Откат V2.0.0: таблицы generated_reports и balance_corrections удалены.');
      return true;
    } catch (e) {
      logger.error(`Ошибка отката V2.0.0: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  },
};
