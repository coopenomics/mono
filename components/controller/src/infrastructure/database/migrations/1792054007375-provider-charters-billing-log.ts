import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Уставы кооперативов в заявке на подключение и журнал биллинг-платежей хаба
 * (B2D-17, биллинг-стек провайдера).
 *
 * `cooperative_charters` — метаданные устава, приложенного к заявке; сам файл
 * лежит в бакете `registrator:charters`. Один и тот же файл кооператива дважды
 * не кладётся (уникальность по контрольной сумме), новые редакции добавляются
 * строками — совет видит историю присланных уставов.
 *
 * `billing_payment_log` — журнал отправленных `billing::pay`: источник
 * идемпотентности рекуррентных списаний (контракт billing таблиц в цепи не
 * ведёт). Запись создаётся до транзакции; уникальный `payment_hash` не даёт
 * списать один платёж дважды.
 *
 * Обе таблицы до перехода на Kysely создавал `synchronize` ветки биллинга,
 * поэтому инструкции идемпотентны: на стенде, где таблицы уже есть, миграция
 * только отмечается применённой.
 */
export class ProviderChartersBillingLog1792054007375 implements MigrationInterface {
  name = 'ProviderChartersBillingLog1792054007375';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "cooperative_charters" ("id" SERIAL NOT NULL, "coopname" character varying NOT NULL, "username" character varying NOT NULL, "checksum_sha256" character varying(64) NOT NULL, "mime_type" character varying(120) NOT NULL, "size_bytes" integer NOT NULL, "storage_key" character varying(512) NOT NULL, "original_filename" character varying(255), "uploaded_by_username" character varying NOT NULL, "uploaded_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cooperative_charters" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`COMMENT ON COLUMN "cooperative_charters"."coopname" IS 'Контур союза, в котором хранится устав'`);
    await queryRunner.query(`COMMENT ON COLUMN "cooperative_charters"."username" IS 'Аккаунт кооператива, чей это устав'`);
    await queryRunner.query(
      `COMMENT ON COLUMN "cooperative_charters"."original_filename" IS 'Оригинальное имя загруженного файла'`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_cooperative_charters_checksum" ON "cooperative_charters" ("coopname", "username", "checksum_sha256")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_cooperative_charters_username" ON "cooperative_charters" ("coopname", "username")`
    );

    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "public"."billing_payment_log_status_enum" AS ENUM('SUBMITTING', 'SUBMITTED', 'CONFIRMED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "billing_payment_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payment_hash" character varying(64) NOT NULL, "coopname" character varying(12) NOT NULL, "quantity" character varying(64) NOT NULL, "subject" character varying(255), "status" "public"."billing_payment_log_status_enum" NOT NULL DEFAULT 'SUBMITTING', "tx_id" character varying(64), "last_error" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_billing_payment_log" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_billing_payment_log_hash" ON "billing_payment_log" ("payment_hash")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "billing_payment_log"');
    await queryRunner.query('DROP TYPE IF EXISTS "public"."billing_payment_log_status_enum"');
    await queryRunner.query('DROP TABLE IF EXISTS "cooperative_charters"');
  }
}
