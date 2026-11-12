import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Инвестиционный этап кооперативного участка в итоге месяца (задача 99D-30).
 *
 * У зеркала итога месяца `marketplace_branch_period` появляются две колонки:
 *  - `invest_phase` — фаза участка по паевым взносам инициаторов на момент расчёта
 *    итога (`MarketplacePeriodInvestPhase`): паевых взносов нет, дефицит (паевые взносы
 *    покрывают недостачу), возмещение паевых взносов либо доля инициаторов
 *    направляется участку. Таблица маленькая (строка на участок и месяц),
 *    поэтому NOT NULL со значением по умолчанию сразу;
 *  - `investor_repaid` — сколько доли инициаторов за прогон возместило их
 *    паевые взносы. Растёт по мере списания строк прогона.
 */
const UP: readonly string[] = [
  `ALTER TABLE "marketplace_branch_period" ADD COLUMN IF NOT EXISTS "invest_phase" character varying(16) NOT NULL DEFAULT 'NONE'`,
  `ALTER TABLE "marketplace_branch_period" ADD COLUMN IF NOT EXISTS "investor_repaid" numeric(24,4) NOT NULL DEFAULT '0'`,
];

const DOWN: readonly string[] = [
  'ALTER TABLE "marketplace_branch_period" DROP COLUMN IF EXISTS "investor_repaid"',
  'ALTER TABLE "marketplace_branch_period" DROP COLUMN IF EXISTS "invest_phase"',
];

export class MarketplaceInvestPeriod1794056162296 implements SchemaMigration {
  name = 'MarketplaceInvestPeriod1794056162296';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
