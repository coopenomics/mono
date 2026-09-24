import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Стартовая миграция таблиц расширения «chairman»: 1 таблиц.
 *
 * Идемпотентна: на пустой базе создаёт всё, на базе, которую раньше вёл
 * synchronize, добавляет только недостающее и ничего не удаляет.
 *
 * Сгенерировано командой `pnpm schema:baseline` — SQL выписан TypeORM из сущностей.
 */
const UP: readonly string[] = [
  "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"",
  "CREATE TABLE IF NOT EXISTS \"chairman_approvals\" (\"_id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"block_num\" integer NOT NULL DEFAULT '0', \"present\" boolean NOT NULL DEFAULT false, \"status\" character varying NOT NULL DEFAULT 'pending', \"_created_at\" TIMESTAMP NOT NULL DEFAULT now(), \"_updated_at\" TIMESTAMP NOT NULL DEFAULT now(), \"id\" integer NOT NULL, \"coopname\" character varying(12) NOT NULL, \"username\" character varying(12) NOT NULL, \"document\" json NOT NULL, \"approval_hash\" character varying(64) NOT NULL, \"callback_contract\" character varying(12) NOT NULL, \"callback_action_approve\" character varying(12) NOT NULL, \"callback_action_decline\" character varying(12) NOT NULL, \"meta\" text NOT NULL, \"created_at\" TIMESTAMP NOT NULL, \"approved_document\" json, CONSTRAINT \"UQ_da91655bb43d3b691cce07704cd\" UNIQUE (\"id\"), CONSTRAINT \"PK_953dacf2b81c83925251061e8f2\" PRIMARY KEY (\"_id\"))",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"_id\" uuid NOT NULL DEFAULT uuid_generate_v4()",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"block_num\" integer NOT NULL DEFAULT '0'",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"present\" boolean NOT NULL DEFAULT false",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"status\" character varying NOT NULL DEFAULT 'pending'",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"_created_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"_updated_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"id\" integer NOT NULL",
  "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '\"chairman_approvals\"'::regclass AND conname = 'UQ_da91655bb43d3b691cce07704cd') AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'UQ_da91655bb43d3b691cce07704cd' AND relkind = 'i') THEN ALTER TABLE \"chairman_approvals\" ADD CONSTRAINT \"UQ_da91655bb43d3b691cce07704cd\" UNIQUE (\"id\"); END IF; END $$",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying(12) NOT NULL",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"username\" character varying(12) NOT NULL",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"document\" json NOT NULL",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"approval_hash\" character varying(64) NOT NULL",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"callback_contract\" character varying(12) NOT NULL",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"callback_action_approve\" character varying(12) NOT NULL",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"callback_action_decline\" character varying(12) NOT NULL",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"meta\" text NOT NULL",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP NOT NULL",
  "ALTER TABLE \"chairman_approvals\" ADD COLUMN IF NOT EXISTS \"approved_document\" json",
  "CREATE INDEX IF NOT EXISTS \"idx_chairman_approvals_status\" ON \"chairman_approvals\" (\"status\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_chairman_approvals_coopname\" ON \"chairman_approvals\" (\"coopname\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_chairman_approvals_username\" ON \"chairman_approvals\" (\"username\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_chairman_approvals_approval_hash\" ON \"chairman_approvals\" (\"approval_hash\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_chairman_approvals_id\" ON \"chairman_approvals\" (\"id\") ",
];

export class ChairmanBaseline1790197276754 implements MigrationInterface {
  name = 'ChairmanBaseline1790197276754';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('ChairmanBaseline1790197276754 не откатывается: удаление таблиц стартовой миграции стёрло бы данные');
  }
}
