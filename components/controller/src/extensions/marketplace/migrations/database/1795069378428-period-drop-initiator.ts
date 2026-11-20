import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Получатель-одиночка доли инициатора удалён из итога месяца участка (решение
 * владельца 19.11.2026). Доля инициаторов делится между пайщиками, внёсшими
 * паевые взносы в участок, по их взносам (инвестиционный этап, 99D-27); без
 * взносов — на общий кошелёк участка. Поле `initiator` строки `kuperiods`
 * контракт больше не пишет, и зеркало `marketplace_branch_period` колонку
 * теряет. Откат возвращает колонку пустой: прежние значения не восстановить,
 * и ни один экран их не показывал.
 */
const UP: readonly string[] = ['ALTER TABLE "marketplace_branch_period" DROP COLUMN IF EXISTS "initiator"'];

const DOWN: readonly string[] = [
  `ALTER TABLE "marketplace_branch_period" ADD COLUMN IF NOT EXISTS "initiator" character varying(13) NOT NULL DEFAULT ''`,
];

export class MarketplacePeriodDropInitiator1795069378428 implements SchemaMigration {
  name = 'MarketplacePeriodDropInitiator1795069378428';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
