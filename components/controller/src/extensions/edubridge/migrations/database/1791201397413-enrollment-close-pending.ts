import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Подписка, которую не удалось закрыть при выходе пайщика из кооператива
 * (расширение «edubridge»): с какого времени она ждёт закрытия и чем кончилась
 * последняя попытка. По отметке закрытие повторяется само, а администратор
 * видит такую подписку у ученика.
 */
const UP: readonly string[] = [
  'ALTER TABLE "edubridge_enrollments" ADD COLUMN IF NOT EXISTS "close_pending_since" TIMESTAMP WITH TIME ZONE',
  'ALTER TABLE "edubridge_enrollments" ADD COLUMN IF NOT EXISTS "close_error" text',
];

const DOWN: readonly string[] = [
  'ALTER TABLE "edubridge_enrollments" DROP COLUMN IF EXISTS "close_error"',
  'ALTER TABLE "edubridge_enrollments" DROP COLUMN IF EXISTS "close_pending_since"',
];

export class EdubridgeEnrollmentClosePending1791201397413 implements MigrationInterface {
  name = 'EdubridgeEnrollmentClosePending1791201397413';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
