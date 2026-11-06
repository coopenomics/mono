import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Временные коды передачи (задача 598-62, второй этап). Пайщик показывает
 * оператору участка случайный код, который выдал сервер и который живёт
 * сутки; по нему сервер находит учётную запись и собирает визит. Код
 * уникален в кооперативе; у одной учётной записи действует один код, по
 * истечении срока выдаётся новый.
 */
const UP: readonly string[] = [
  'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
  'CREATE TABLE IF NOT EXISTS "marketplace_handoff_code" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "coopname" character varying(13) NOT NULL, "account" character varying(13) NOT NULL, "token" character varying(16) NOT NULL, "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_marketplace_handoff_code" PRIMARY KEY ("id"))',
  'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketplace_handoff_code_token_unique" ON "marketplace_handoff_code" ("coopname", "token")',
  'CREATE INDEX IF NOT EXISTS "IDX_marketplace_handoff_code_account" ON "marketplace_handoff_code" ("coopname", "account", "expires_at")',
];

const DOWN: readonly string[] = ['DROP TABLE IF EXISTS "marketplace_handoff_code"'];

export class MarketplaceHandoffCode1791736800000 implements MigrationInterface {
  name = 'MarketplaceHandoffCode1791736800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
