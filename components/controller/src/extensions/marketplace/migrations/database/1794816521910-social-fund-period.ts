import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Доля фонда социально-экономического взаимодействия и социального обеспечения
 * в итоге месяца участка (решение владельца 16.11.2026, модель методолога
 * 13.11.2026).
 *
 * Миграция добавляет зеркалу итога месяца `marketplace_branch_period` две колонки —
 * поля строки `kuperiods`, которые контракт пишет по новому дележу экономии:
 *  - `social_amount` — СФ, вторые 38,2 % экономии на кошелёк фонда по участку;
 *  - `rate_social` — доля стоимости заказа в этот фонд.
 * У итогов до 16.11.2026 доли фонда нет — ноль.
 */
const UP: readonly string[] = [
  `ALTER TABLE "marketplace_branch_period" ADD COLUMN IF NOT EXISTS "social_amount" numeric(24,4) NOT NULL DEFAULT 0`,
  `ALTER TABLE "marketplace_branch_period" ADD COLUMN IF NOT EXISTS "rate_social" bigint NOT NULL DEFAULT 0`,
];

const DOWN: readonly string[] = [
  'ALTER TABLE "marketplace_branch_period" DROP COLUMN IF EXISTS "rate_social"',
  'ALTER TABLE "marketplace_branch_period" DROP COLUMN IF EXISTS "social_amount"',
];

export class MarketplaceSocialFundPeriod1794816521910 implements SchemaMigration {
  name = 'MarketplaceSocialFundPeriod1794816521910';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
