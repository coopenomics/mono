import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Захват шага выдачи и напоминание о закрывающей подписи (99D-18).
 *
 * Подпись акта пайщиком и закрывающую подпись оператора ставят столы сами, в
 * фоне. Открытых столов бывает несколько: два оператора участка, один человек
 * на телефоне и компьютере. Перед отправкой в цепь стол захватывает шаг
 * (`step_claimed_at`, `step_claimed_by`); второй стол видит захват и молча
 * обновляет экран, вместо того чтобы отправить вторую транзакцию и получить
 * отказ цепи.
 *
 * Тот же захват — у приёмки: подпись поставщика и закрывающая подпись
 * председателя участка ставятся кнопкой, и нажатие на двух устройствах сразу
 * не должно отправить две транзакции.
 *
 * `close_reminded_at` — когда оператору направлено напоминание о закрывающей
 * подписи: выдача, не закрытая за час, напоминает о себе один раз.
 */
const UP: readonly string[] = [
  'ALTER TABLE "marketplace_issuance_saga" ADD COLUMN IF NOT EXISTS "step_claimed_at" TIMESTAMP WITH TIME ZONE',
  'ALTER TABLE "marketplace_issuance_saga" ADD COLUMN IF NOT EXISTS "step_claimed_by" text',
  'ALTER TABLE "marketplace_issuance_saga" ADD COLUMN IF NOT EXISTS "close_reminded_at" TIMESTAMP WITH TIME ZONE',
  'ALTER TABLE "marketplace_apl_reception" ADD COLUMN IF NOT EXISTS "step_claimed_at" TIMESTAMP WITH TIME ZONE',
  'ALTER TABLE "marketplace_apl_reception" ADD COLUMN IF NOT EXISTS "step_claimed_by" text',
];

const DOWN: readonly string[] = [
  'ALTER TABLE "marketplace_apl_reception" DROP COLUMN IF EXISTS "step_claimed_by"',
  'ALTER TABLE "marketplace_apl_reception" DROP COLUMN IF EXISTS "step_claimed_at"',
  'ALTER TABLE "marketplace_issuance_saga" DROP COLUMN IF EXISTS "close_reminded_at"',
  'ALTER TABLE "marketplace_issuance_saga" DROP COLUMN IF EXISTS "step_claimed_by"',
  'ALTER TABLE "marketplace_issuance_saga" DROP COLUMN IF EXISTS "step_claimed_at"',
];

export class MarketplaceIssuanceStepClaim1793480000000 implements MigrationInterface {
  name = 'MarketplaceIssuanceStepClaim1793480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
