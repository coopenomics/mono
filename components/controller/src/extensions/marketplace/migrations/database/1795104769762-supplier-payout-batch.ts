import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Пакет выплаты поставщику (решение владельца 19.11.2026): запись проекции —
 * пакет заказов поставщика за день, один платёж кассиру. Прежде запись была на
 * каждый заказ (`order_hash`, `order_id`, `apl_reception_id`).
 *
 * Выплаты по одному заказу нигде не эксплуатировались (слово владельца), поэтому
 * перехода нет: прежние записи удаляются, хэш заказа становится хэшем пакета,
 * ссылки на заказ и акт заменяет список заказов пакета `lines`. `settled_at` —
 * все заказы пакета закрыты (оплачены либо возвращены в ожидание выплаты).
 */
const UP: readonly string[] = [
  'DELETE FROM "marketplace_outgoing_payment_request"',
  'ALTER TABLE "marketplace_outgoing_payment_request" RENAME COLUMN "order_hash" TO "payment_hash"',
  'ALTER TABLE "marketplace_outgoing_payment_request" DROP COLUMN IF EXISTS "order_id"',
  'ALTER TABLE "marketplace_outgoing_payment_request" DROP COLUMN IF EXISTS "apl_reception_id"',
  'ALTER TABLE "marketplace_outgoing_payment_request" ADD COLUMN IF NOT EXISTS "lines" jsonb NOT NULL DEFAULT \'[]\'',
  'ALTER TABLE "marketplace_outgoing_payment_request" ADD COLUMN IF NOT EXISTS "settled_at" TIMESTAMP WITH TIME ZONE',
  'CREATE UNIQUE INDEX IF NOT EXISTS "ux_mkt_outgoing_payment_hash" ON "marketplace_outgoing_payment_request" ("coopname", "payment_hash")',
  // Обход выплат читает только пакеты с незакрытыми заказами — по индексу, не всю историю.
  'CREATE INDEX IF NOT EXISTS "ix_mkt_outgoing_payment_unsettled" ON "marketplace_outgoing_payment_request" ("coopname", "status") WHERE "settled_at" IS NULL',
];

const DOWN: readonly string[] = [
  'DROP INDEX IF EXISTS "ix_mkt_outgoing_payment_unsettled"',
  'DROP INDEX IF EXISTS "ux_mkt_outgoing_payment_hash"',
  'ALTER TABLE "marketplace_outgoing_payment_request" DROP COLUMN IF EXISTS "settled_at"',
  'DELETE FROM "marketplace_outgoing_payment_request"',
  'ALTER TABLE "marketplace_outgoing_payment_request" DROP COLUMN IF EXISTS "lines"',
  'ALTER TABLE "marketplace_outgoing_payment_request" ADD COLUMN IF NOT EXISTS "apl_reception_id" uuid NOT NULL',
  'ALTER TABLE "marketplace_outgoing_payment_request" ADD COLUMN IF NOT EXISTS "order_id" uuid NOT NULL',
  'ALTER TABLE "marketplace_outgoing_payment_request" RENAME COLUMN "payment_hash" TO "order_hash"',
];

export class MarketplaceSupplierPayoutBatch1795104769762 implements SchemaMigration {
  name = 'MarketplaceSupplierPayoutBatch1795104769762';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
