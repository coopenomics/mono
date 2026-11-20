import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Учёт доверенностей кооператива (решение владельца 18.11.2026).
 *
 * Цепь хранит подписи: доверенность подписывает доверенное лицо (signauth,
 * reqtrusted), встречно — председатель совета (apprauth) или председатель
 * участка (apprtrusted). Узел по этим событиям ведёт строку на каждую
 * доверенность: сквозной номер в кооперативе, тип, участок, основание
 * (протокол совета), срок и состояние. Строка в оперативной памяти цепи не
 * хранится. Состояние «срок истёк» не пишется — его даёт сравнение
 * `valid_until` с текущей датой.
 */
const UP: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "ku_powers_of_attorney" (
     "id" serial PRIMARY KEY,
     "coopname" varchar(12) NOT NULL,
     "number" integer NOT NULL,
     "type" varchar(32) NOT NULL,
     "registry_id" integer NOT NULL,
     "braname" varchar(12) NOT NULL,
     "holder" varchar(12) NOT NULL,
     "document_hash" varchar(64) NOT NULL,
     "source_hash" varchar(64) NULL,
     "document" jsonb NOT NULL,
     "countersigned" jsonb NULL,
     "protocol_number" varchar(32) NOT NULL DEFAULT '',
     "protocol_date" varchar(16) NOT NULL DEFAULT '',
     "issued_at" date NOT NULL,
     "valid_until" date NOT NULL,
     "status" varchar(16) NOT NULL DEFAULT 'pending',
     "signed_at" timestamptz NOT NULL DEFAULT now(),
     "resolved_at" timestamptz NULL,
     "renewal_notified_at" timestamptz NULL,
     "created_at" timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ku_poa_document" ON "ku_powers_of_attorney" ("document_hash")`,
  `CREATE INDEX IF NOT EXISTS "IDX_ku_poa_number" ON "ku_powers_of_attorney" ("coopname", "number")`,
  `CREATE INDEX IF NOT EXISTS "IDX_ku_poa_holder" ON "ku_powers_of_attorney" ("coopname", "braname", "holder", "type")`,
  `CREATE INDEX IF NOT EXISTS "IDX_ku_poa_valid_until" ON "ku_powers_of_attorney" ("coopname", "status", "valid_until")`,
  `CREATE INDEX IF NOT EXISTS "IDX_ku_poa_source" ON "ku_powers_of_attorney" ("source_hash")`,
];

const DOWN: readonly string[] = [`DROP TABLE IF EXISTS "ku_powers_of_attorney"`];

export class KuPowersOfAttorney1795000000000 implements MigrationInterface {
  name = 'KuPowersOfAttorney1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
