import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Приглашение оставить отзыв (задача 598-61). Заказчику через несколько часов
 * после получения заказа уходит одно уведомление со ссылкой на форму отзыва.
 * `review_invited_at` — когда приглашение ушло: по этой отметке заказ больше
 * не попадает в выборку, и приглашение не повторяется.
 */
const UP: readonly string[] = [
  'ALTER TABLE "marketplace_order" ADD COLUMN IF NOT EXISTS "review_invited_at" TIMESTAMP WITH TIME ZONE',
];

const DOWN: readonly string[] = ['ALTER TABLE "marketplace_order" DROP COLUMN IF EXISTS "review_invited_at"'];

export class MarketplaceOrderReviewInvite1791723152953 implements MigrationInterface {
  name = 'MarketplaceOrderReviewInvite1791723152953';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
