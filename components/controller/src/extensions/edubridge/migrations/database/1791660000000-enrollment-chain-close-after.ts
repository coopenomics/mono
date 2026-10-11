import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Срок на отчёт преподавателя (расширение «edubridge»). Оплаченный срок вышел —
 * доступ отзывается сразу, а расчёт по подписке в цепи закрывается позже:
 * преподаватель успевает отчитаться о занятиях этого срока и получить за них
 * взнос. Колонка хранит момент, после которого подписка закрывается в цепи.
 */
const UP: readonly string[] = ['ALTER TABLE "edubridge_enrollments" ADD COLUMN IF NOT EXISTS "chain_close_after" TIMESTAMP WITH TIME ZONE'];

const DOWN: readonly string[] = ['ALTER TABLE "edubridge_enrollments" DROP COLUMN IF EXISTS "chain_close_after"'];

export class EdubridgeEnrollmentChainCloseAfter1791660000000 implements MigrationInterface {
  name = 'EdubridgeEnrollmentChainCloseAfter1791660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
