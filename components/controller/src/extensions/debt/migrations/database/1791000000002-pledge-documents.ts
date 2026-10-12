import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Залог оформляется отдельными документами: договор залога имущественного
 * права (подписи пайщика и председателя) и акт передачи права в залог
 * (подписи председателя и пайщика). Колонки зеркала под поля строки
 * `debt::debts`, добавленные расширениями таблицы.
 */
const UP: readonly string[] = [
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "pledge_contract" jsonb',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "signed_pledge_contract" jsonb',
  'ALTER TABLE "debt_loans" ADD COLUMN IF NOT EXISTS "act" jsonb',
];

export class DebtPledgeDocuments1791000000002 implements MigrationInterface {
  name = 'DebtPledgeDocuments1791000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "debt_loans" DROP COLUMN IF EXISTS "act"');
    await queryRunner.query('ALTER TABLE "debt_loans" DROP COLUMN IF EXISTS "signed_pledge_contract"');
    await queryRunner.query('ALTER TABLE "debt_loans" DROP COLUMN IF EXISTS "pledge_contract"');
  }
}
