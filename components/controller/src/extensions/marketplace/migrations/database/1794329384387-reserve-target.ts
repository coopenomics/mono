import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Расходы участка по цели резерва в итоге месяца (задача 99D-34).
 *
 * У зеркала итога месяца `marketplace_branch_period` появляются четыре колонки —
 * поля строки `kuperiods`, которые контракт пишет по новой формуле:
 *  - `planned_target` — цель плановых расходов на следующий месяц;
 *  - `target` — цель резерва участка: плановые расходы и накопленное право
 *    получателей помощи;
 *  - `target_prev` — собранная часть цели прошлого итога;
 *  - `target_funded` — собранная часть цели этого итога.
 * У итогов, посчитанных до 99D-34, полей нет — колонки пустые (NULL).
 */
const UP: readonly string[] = [
  `ALTER TABLE "marketplace_branch_period" ADD COLUMN IF NOT EXISTS "planned_target" numeric(24,4)`,
  `ALTER TABLE "marketplace_branch_period" ADD COLUMN IF NOT EXISTS "target" numeric(24,4)`,
  `ALTER TABLE "marketplace_branch_period" ADD COLUMN IF NOT EXISTS "target_prev" numeric(24,4)`,
  `ALTER TABLE "marketplace_branch_period" ADD COLUMN IF NOT EXISTS "target_funded" numeric(24,4)`,
];

const DOWN: readonly string[] = [
  'ALTER TABLE "marketplace_branch_period" DROP COLUMN IF EXISTS "target_funded"',
  'ALTER TABLE "marketplace_branch_period" DROP COLUMN IF EXISTS "target_prev"',
  'ALTER TABLE "marketplace_branch_period" DROP COLUMN IF EXISTS "target"',
  'ALTER TABLE "marketplace_branch_period" DROP COLUMN IF EXISTS "planned_target"',
];

export class MarketplaceReserveTarget1794329384387 implements SchemaMigration {
  name = 'MarketplaceReserveTarget1794329384387';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
