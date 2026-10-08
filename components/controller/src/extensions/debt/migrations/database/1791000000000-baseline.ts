import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Стартовая миграция таблиц расширения «debt»: зеркало займов `debt_loans`.
 *
 * Идемпотентна: на пустой базе создаёт таблицу, на существующей добавляет
 * недостающие колонки и индексы, ничего не удаляет. Написана по образцу
 * стартовых миграций расширений (колонки `ChainRecord` + поля строки
 * `debt::debts`).
 */
const UP: readonly string[] = [
  'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
  'CREATE TABLE IF NOT EXISTS "debt_loans" ("_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "block_num" integer NOT NULL DEFAULT \'0\', "present" boolean NOT NULL DEFAULT false, "status" character varying NOT NULL DEFAULT \'UNDEFINED\', "_created_at" TIMESTAMP NOT NULL DEFAULT now(), "_updated_at" TIMESTAMP NOT NULL DEFAULT now(), "id" integer, "debt_hash" character varying(64) NOT NULL, "coopname" character varying(13) NOT NULL, "username" character varying(13), "blockchain_status" character varying(13), "collateral" character varying(13), "source" character varying(13), "source_ref" character varying(64), "amount" character varying, "remaining" character varying, "pledged" character varying, "created_at" TIMESTAMP, "issued_at" TIMESTAMP, "due_at" TIMESTAMP, "requested_due_at" TIMESTAMP, "overdue_at" TIMESTAMP, "statement" jsonb, "contract" jsonb, "signed_contract" jsonb, "decision" jsonb, "extension_statement" jsonb, "last_pay_error" text, "memo" text, CONSTRAINT "PK_debt_loans__id" PRIMARY KEY ("_id"))',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "id" integer',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "debt_hash" character varying(64) NOT NULL',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "coopname" character varying(13) NOT NULL',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "username" character varying(13)',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "blockchain_status" character varying(13)',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "collateral" character varying(13)',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "source" character varying(13)',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "source_ref" character varying(64)',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "amount" character varying',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "remaining" character varying',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "pledged" character varying',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "issued_at" TIMESTAMP',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "due_at" TIMESTAMP',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "requested_due_at" TIMESTAMP',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "overdue_at" TIMESTAMP',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "statement" jsonb',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "contract" jsonb',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "signed_contract" jsonb',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "decision" jsonb',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "extension_statement" jsonb',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "last_pay_error" text',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "memo" text',
  'CREATE UNIQUE INDEX IF NOT EXISTS "uq_debt_loans_debt_hash" ON "debt_loans" ("debt_hash")',
  'CREATE INDEX IF NOT EXISTS "idx_debt_loans_coopname_username" ON "debt_loans" ("coopname", "username")',
  'CREATE INDEX IF NOT EXISTS "idx_debt_loans_status" ON "debt_loans" ("status")',
  'CREATE INDEX IF NOT EXISTS "idx_debt_loans_due_at" ON "debt_loans" ("due_at")',
  'CREATE INDEX IF NOT EXISTS "idx_debt_loans_created_at" ON "debt_loans" ("_created_at")',
];

export class DebtBaseline1791000000000 implements MigrationInterface {
  name = 'DebtBaseline1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(): Promise<void> {
    // Стартовая миграция назад не откатывается: таблица зеркала нужна всем следующим.
  }
}
