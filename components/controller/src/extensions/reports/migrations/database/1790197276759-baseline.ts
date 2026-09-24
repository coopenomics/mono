import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Стартовая миграция таблиц расширения «reports»: 5 таблиц.
 *
 * Идемпотентна: на пустой базе создаёт всё, на базе, которую раньше вёл
 * synchronize, добавляет только недостающее и ничего не удаляет.
 *
 * Сгенерировано командой `pnpm schema:baseline` — SQL выписан TypeORM из сущностей.
 */
const UP: readonly string[] = [
  "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"",
  "CREATE TABLE IF NOT EXISTS \"generated_reports\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"coopname\" character varying(64) NOT NULL, \"report_type\" character varying(32) NOT NULL, \"year\" integer NOT NULL, \"period\" integer, \"xml\" text NOT NULL, \"file_name\" character varying(255) NOT NULL, \"is_valid\" boolean NOT NULL DEFAULT false, \"validation_errors\" jsonb, \"organization_snapshot\" jsonb NOT NULL, \"corrections_snapshot\" jsonb, \"generated_by\" character varying(255) NOT NULL, \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"PK_3875618b27e8f2d438168399374\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE IF NOT EXISTS \"balance_corrections\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"coopname\" character varying(64) NOT NULL, \"year\" integer NOT NULL, \"account_display_id\" character varying(20) NOT NULL, \"balance_previous\" numeric(20,2) NOT NULL DEFAULT '0', \"balance_pre_previous\" numeric(20,2) NOT NULL DEFAULT '0', \"updated_by\" character varying(255) NOT NULL, \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"uq_balance_corrections_coop_year_account\" UNIQUE (\"coopname\", \"year\", \"account_display_id\"), CONSTRAINT \"PK_57a8532d9f9958a073126ede427\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE IF NOT EXISTS \"report_requisites\" (\"coopname\" character varying(64) NOT NULL, \"okved\" character varying(16), \"okfs\" character varying(8), \"okopf\" character varying(16), \"oktmo\" character varying(16), \"okpo\" character varying(16), \"sfr_reg_number\" character varying(32), \"pfr_reg_number\" character varying(32), \"chairman_position\" character varying(255), \"signer_snils\" character varying(32), \"signer_inn\" character varying(12), \"signer_rep_doc\" character varying(255), \"signer_type\" character varying(16), \"phone_override\" character varying(64), \"address_override\" character varying(512), \"updated_by\" character varying(255) NOT NULL, \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"PK_cd8bcf4663952cf51a9e3c1841c\" PRIMARY KEY (\"coopname\"))",
  "CREATE TABLE IF NOT EXISTS \"report_drafts\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"coopname\" character varying(64) NOT NULL, \"owner_username\" character varying(255) NOT NULL, \"report_type\" character varying(32) NOT NULL, \"year\" integer NOT NULL, \"period\" integer, \"edits_json\" jsonb NOT NULL, \"edited_fields\" jsonb NOT NULL DEFAULT '[]', \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"uq_report_draft_owner_type_period\" UNIQUE (\"coopname\", \"owner_username\", \"report_type\", \"year\", \"period\"), CONSTRAINT \"PK_2b62b57b504949ac48203d81e5b\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE IF NOT EXISTS \"report_submission_marks\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"coopname\" character varying(64) NOT NULL, \"report_type\" character varying(32) NOT NULL, \"year\" integer NOT NULL, \"period\" integer, \"mark\" character varying(32) NOT NULL, \"created_by\" character varying(255) NOT NULL, \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"uq_report_submission_mark_period\" UNIQUE (\"coopname\", \"report_type\", \"year\", \"period\"), CONSTRAINT \"PK_d24b1c802fc40b9a2256602bb84\" PRIMARY KEY (\"id\"))",
  "ALTER TABLE \"generated_reports\" ADD COLUMN IF NOT EXISTS \"id\" uuid NOT NULL DEFAULT uuid_generate_v4()",
  "ALTER TABLE \"generated_reports\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying(64) NOT NULL",
  "ALTER TABLE \"generated_reports\" ADD COLUMN IF NOT EXISTS \"report_type\" character varying(32) NOT NULL",
  "ALTER TABLE \"generated_reports\" ADD COLUMN IF NOT EXISTS \"year\" integer NOT NULL",
  "ALTER TABLE \"generated_reports\" ADD COLUMN IF NOT EXISTS \"period\" integer",
  "ALTER TABLE \"generated_reports\" ADD COLUMN IF NOT EXISTS \"xml\" text NOT NULL",
  "ALTER TABLE \"generated_reports\" ADD COLUMN IF NOT EXISTS \"file_name\" character varying(255) NOT NULL",
  "ALTER TABLE \"generated_reports\" ADD COLUMN IF NOT EXISTS \"is_valid\" boolean NOT NULL DEFAULT false",
  "ALTER TABLE \"generated_reports\" ADD COLUMN IF NOT EXISTS \"validation_errors\" jsonb",
  "ALTER TABLE \"generated_reports\" ADD COLUMN IF NOT EXISTS \"organization_snapshot\" jsonb NOT NULL",
  "ALTER TABLE \"generated_reports\" ADD COLUMN IF NOT EXISTS \"corrections_snapshot\" jsonb",
  "ALTER TABLE \"generated_reports\" ADD COLUMN IF NOT EXISTS \"generated_by\" character varying(255) NOT NULL",
  "ALTER TABLE \"generated_reports\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
  "ALTER TABLE \"balance_corrections\" ADD COLUMN IF NOT EXISTS \"id\" uuid NOT NULL DEFAULT uuid_generate_v4()",
  "ALTER TABLE \"balance_corrections\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying(64) NOT NULL",
  "ALTER TABLE \"balance_corrections\" ADD COLUMN IF NOT EXISTS \"year\" integer NOT NULL",
  "ALTER TABLE \"balance_corrections\" ADD COLUMN IF NOT EXISTS \"account_display_id\" character varying(20) NOT NULL",
  "ALTER TABLE \"balance_corrections\" ADD COLUMN IF NOT EXISTS \"balance_previous\" numeric(20,2) NOT NULL DEFAULT '0'",
  "ALTER TABLE \"balance_corrections\" ADD COLUMN IF NOT EXISTS \"balance_pre_previous\" numeric(20,2) NOT NULL DEFAULT '0'",
  "ALTER TABLE \"balance_corrections\" ADD COLUMN IF NOT EXISTS \"updated_by\" character varying(255) NOT NULL",
  "ALTER TABLE \"balance_corrections\" ADD COLUMN IF NOT EXISTS \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying(64) NOT NULL",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"okved\" character varying(16)",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"okfs\" character varying(8)",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"okopf\" character varying(16)",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"oktmo\" character varying(16)",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"okpo\" character varying(16)",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"sfr_reg_number\" character varying(32)",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"pfr_reg_number\" character varying(32)",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"chairman_position\" character varying(255)",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"signer_snils\" character varying(32)",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"signer_inn\" character varying(12)",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"signer_rep_doc\" character varying(255)",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"signer_type\" character varying(16)",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"phone_override\" character varying(64)",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"address_override\" character varying(512)",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"updated_by\" character varying(255) NOT NULL",
  "ALTER TABLE \"report_requisites\" ADD COLUMN IF NOT EXISTS \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
  "ALTER TABLE \"report_drafts\" ADD COLUMN IF NOT EXISTS \"id\" uuid NOT NULL DEFAULT uuid_generate_v4()",
  "ALTER TABLE \"report_drafts\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying(64) NOT NULL",
  "ALTER TABLE \"report_drafts\" ADD COLUMN IF NOT EXISTS \"owner_username\" character varying(255) NOT NULL",
  "ALTER TABLE \"report_drafts\" ADD COLUMN IF NOT EXISTS \"report_type\" character varying(32) NOT NULL",
  "ALTER TABLE \"report_drafts\" ADD COLUMN IF NOT EXISTS \"year\" integer NOT NULL",
  "ALTER TABLE \"report_drafts\" ADD COLUMN IF NOT EXISTS \"period\" integer",
  "ALTER TABLE \"report_drafts\" ADD COLUMN IF NOT EXISTS \"edits_json\" jsonb NOT NULL",
  "ALTER TABLE \"report_drafts\" ADD COLUMN IF NOT EXISTS \"edited_fields\" jsonb NOT NULL DEFAULT '[]'",
  "ALTER TABLE \"report_drafts\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
  "ALTER TABLE \"report_drafts\" ADD COLUMN IF NOT EXISTS \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
  "ALTER TABLE \"report_submission_marks\" ADD COLUMN IF NOT EXISTS \"id\" uuid NOT NULL DEFAULT uuid_generate_v4()",
  "ALTER TABLE \"report_submission_marks\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying(64) NOT NULL",
  "ALTER TABLE \"report_submission_marks\" ADD COLUMN IF NOT EXISTS \"report_type\" character varying(32) NOT NULL",
  "ALTER TABLE \"report_submission_marks\" ADD COLUMN IF NOT EXISTS \"year\" integer NOT NULL",
  "ALTER TABLE \"report_submission_marks\" ADD COLUMN IF NOT EXISTS \"period\" integer",
  "ALTER TABLE \"report_submission_marks\" ADD COLUMN IF NOT EXISTS \"mark\" character varying(32) NOT NULL",
  "ALTER TABLE \"report_submission_marks\" ADD COLUMN IF NOT EXISTS \"created_by\" character varying(255) NOT NULL",
  "ALTER TABLE \"report_submission_marks\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
  "ALTER TABLE \"report_submission_marks\" ADD COLUMN IF NOT EXISTS \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
  "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '\"balance_corrections\"'::regclass AND conname = 'uq_balance_corrections_coop_year_account') AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_balance_corrections_coop_year_account' AND relkind = 'i') THEN ALTER TABLE \"balance_corrections\" ADD CONSTRAINT \"uq_balance_corrections_coop_year_account\" UNIQUE (\"coopname\", \"year\", \"account_display_id\"); END IF; END $$",
  "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '\"report_drafts\"'::regclass AND conname = 'uq_report_draft_owner_type_period') AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_report_draft_owner_type_period' AND relkind = 'i') THEN ALTER TABLE \"report_drafts\" ADD CONSTRAINT \"uq_report_draft_owner_type_period\" UNIQUE (\"coopname\", \"owner_username\", \"report_type\", \"year\", \"period\"); END IF; END $$",
  "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '\"report_submission_marks\"'::regclass AND conname = 'uq_report_submission_mark_period') AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_report_submission_mark_period' AND relkind = 'i') THEN ALTER TABLE \"report_submission_marks\" ADD CONSTRAINT \"uq_report_submission_mark_period\" UNIQUE (\"coopname\", \"report_type\", \"year\", \"period\"); END IF; END $$",
  "CREATE INDEX IF NOT EXISTS \"IDX_4a381ebd13240b0cfc12243cb1\" ON \"generated_reports\" (\"coopname\") ",
  "CREATE INDEX IF NOT EXISTS \"IDX_e6431b888273f479bb4aa16753\" ON \"generated_reports\" (\"report_type\", \"created_at\") ",
  "CREATE INDEX IF NOT EXISTS \"IDX_35a074ae93aad275b23ae7dc84\" ON \"generated_reports\" (\"coopname\", \"created_at\") ",
  "CREATE INDEX IF NOT EXISTS \"IDX_daaf745936c429f9360860f3b7\" ON \"generated_reports\" (\"coopname\", \"report_type\", \"year\", \"period\") ",
  "CREATE INDEX IF NOT EXISTS \"IDX_93f4abf3e28ddcdfee18f440d1\" ON \"balance_corrections\" (\"coopname\", \"year\") ",
  "CREATE INDEX IF NOT EXISTS \"IDX_15279840aa9884172cca05ec56\" ON \"report_drafts\" (\"coopname\", \"owner_username\") ",
  "CREATE INDEX IF NOT EXISTS \"IDX_a08c247e987a78cba8c9053239\" ON \"report_submission_marks\" (\"coopname\", \"report_type\", \"year\") ",
];

export class ReportsBaseline1790197276759 implements MigrationInterface {
  name = 'ReportsBaseline1790197276759';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('ReportsBaseline1790197276759 не откатывается: удаление таблиц стартовой миграции стёрло бы данные');
  }
}
