import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Учёт обеспечительной части паевого взноса к списанию по заказам (задача
 * 99D-18, решение владельца 31.10.2026).
 *
 * Обеспечительная часть с выдачи и удержание при отказе лежат на кошельке
 * пайщика к списанию w.mkt.due. Контракт не хранит, кому и когда списывать —
 * учёт ведёт узел: строка на заказ, остаток к списанию, момент, с которого
 * списание допустимо (конец гарантийного срока), и отметка списания. Суммы
 * пишет слушатель операций ledger2 — из того, что провёл контракт.
 */
const UP: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "marketplace_secure_due" (
    "order_hash" character varying(64) NOT NULL,
    "coopname" character varying(13) NOT NULL,
    "username" character varying(13) NOT NULL,
    "braname" character varying(13) NOT NULL,
    "due_amount" numeric(24,4) NOT NULL DEFAULT '0',
    "charged_amount" numeric(24,4) NOT NULL DEFAULT '0',
    "due_from" TIMESTAMP WITH TIME ZONE,
    "charged_at" TIMESTAMP WITH TIME ZONE,
    "last_sequence" character varying(32) NOT NULL DEFAULT '0',
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT "PK_marketplace_secure_due" PRIMARY KEY ("order_hash")
  )`,
  'CREATE INDEX IF NOT EXISTS "IDX_marketplace_secure_due_pending" ON "marketplace_secure_due" ("coopname", "charged_at", "due_from")',
  'CREATE INDEX IF NOT EXISTS "IDX_marketplace_secure_due_user" ON "marketplace_secure_due" ("coopname", "username")',
];

export class MarketplaceSecureDue1793440000000 implements MigrationInterface {
  name = 'MarketplaceSecureDue1793440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "marketplace_secure_due"');
  }
}
