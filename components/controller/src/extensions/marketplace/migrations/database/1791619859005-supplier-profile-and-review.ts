import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Профиль поставщика и отзывы заказчиков (задача 598-61).
 *
 * `marketplace_supplier_profile` — что поставщик рассказывает о себе: одна
 * запись на учётную запись (кооператив — тоже поставщик, когда выставляет
 * остаток своего склада). `marketplace_review` — отзыв заказчика по
 * полученному заказу: заказ — одна позиция предложения, поэтому отзыв на
 * заказ один. Обе таблицы живут только в базе узла, в цепь не пишутся.
 */
const UP: readonly string[] = [
  'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
  'CREATE TABLE IF NOT EXISTS "marketplace_supplier_profile" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "coopname" character varying(13) NOT NULL, "supplier_account" character varying(13) NOT NULL, "display_name" character varying(200), "about" text NOT NULL DEFAULT \'\', "cover" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_marketplace_supplier_profile" PRIMARY KEY ("id"))',
  'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketplace_supplier_profile_account_unique" ON "marketplace_supplier_profile" ("coopname", "supplier_account")',
  'CREATE TABLE IF NOT EXISTS "marketplace_review" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "coopname" character varying(13) NOT NULL, "order_id" uuid NOT NULL, "offer_id" uuid NOT NULL, "supplier_account" character varying(13) NOT NULL, "author_account" character varying(13) NOT NULL, "stars" smallint NOT NULL, "text" text NOT NULL DEFAULT \'\', "status" character varying(16) NOT NULL DEFAULT \'PUBLISHED\', "hidden_by" character varying(13), "hidden_at" TIMESTAMP WITH TIME ZONE, "hidden_reason" character varying(1000), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_marketplace_review" PRIMARY KEY ("id"), CONSTRAINT "CHK_marketplace_review_stars" CHECK ("stars" BETWEEN 1 AND 5))',
  'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_marketplace_review_order_unique" ON "marketplace_review" ("coopname", "order_id")',
  'CREATE INDEX IF NOT EXISTS "IDX_marketplace_review_offer" ON "marketplace_review" ("coopname", "offer_id", "status")',
  'CREATE INDEX IF NOT EXISTS "IDX_marketplace_review_supplier" ON "marketplace_review" ("coopname", "supplier_account", "status")',
  'CREATE INDEX IF NOT EXISTS "IDX_marketplace_review_author" ON "marketplace_review" ("coopname", "author_account")',
];

const DOWN: readonly string[] = [
  'DROP TABLE IF EXISTS "marketplace_review"',
  'DROP TABLE IF EXISTS "marketplace_supplier_profile"',
];

export class MarketplaceSupplierProfileAndReview1791619859005 implements MigrationInterface {
  name = 'MarketplaceSupplierProfileAndReview1791619859005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
