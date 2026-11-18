import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Учёт договоров о полной материальной ответственности председателей участков
 * (решение владельца 18.11.2026). Узел пишет строку по событию подписи
 * председателем участка (signliab) и меняет состояние по встречной подписи
 * председателя совета (apprliab) или отказу (declliab). Запись в эту таблицу
 * даёт сигнал ленте изменений: «Мой участок» обновляется сам, без перезагрузки.
 */
const UP: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "ku_trustee_liabilities" (
     "id" serial PRIMARY KEY,
     "coopname" varchar(12) NOT NULL,
     "braname" varchar(12) NOT NULL,
     "holder" varchar(12) NOT NULL,
     "document_hash" varchar(64) NOT NULL,
     "document" jsonb NOT NULL,
     "countersigned" jsonb NULL,
     "status" varchar(16) NOT NULL DEFAULT 'pending',
     "signed_at" timestamptz NOT NULL DEFAULT now(),
     "resolved_at" timestamptz NULL
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ku_trustee_liability_document" ON "ku_trustee_liabilities" ("document_hash")`,
  `CREATE INDEX IF NOT EXISTS "IDX_ku_trustee_liability_holder" ON "ku_trustee_liabilities" ("coopname", "braname", "holder")`,
];

const DOWN: readonly string[] = [`DROP TABLE IF EXISTS "ku_trustee_liabilities"`];

export class KuTrusteeLiabilities1795000000001 implements MigrationInterface {
  name = 'KuTrusteeLiabilities1795000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
