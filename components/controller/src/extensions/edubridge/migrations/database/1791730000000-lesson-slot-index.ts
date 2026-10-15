import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Окно занятия (расширение «edubridge»). Стоимость занятия для участника
 * задаётся окном расписания; занятие помнит индекс своего окна в условиях
 * группы, по нему контракт находит стоимость при отчёте.
 */
const UP: readonly string[] = ['ALTER TABLE "edubridge_lessons" ADD COLUMN IF NOT EXISTS "slot_index" integer NOT NULL DEFAULT 0'];

const DOWN: readonly string[] = ['ALTER TABLE "edubridge_lessons" DROP COLUMN IF EXISTS "slot_index"'];

export class EdubridgeLessonSlotIndex1791730000000 implements MigrationInterface {
  name = 'EdubridgeLessonSlotIndex1791730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
