import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Номер занятия уникален в группе, а не в курсе (расширение «edubridge»).
 * Журнал занятий заведён до групп: уникальный индекс стоял на паре «курс,
 * номер», и вторая группа курса не могла отчитать занятие № 1. Занятие без
 * группы — запись до перевода на группы, для неё остаётся прежнее правило.
 */
const UP: readonly string[] = [
  'DROP INDEX IF EXISTS "IDX_edubridge_lessons_unique"',
  'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_edubridge_lessons_unique_group" ON "edubridge_lessons" ("coopname", "group_id", "lesson_number") WHERE "group_id" IS NOT NULL',
  'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_edubridge_lessons_unique_course" ON "edubridge_lessons" ("coopname", "course_id", "lesson_number") WHERE "group_id" IS NULL',
];

const DOWN: readonly string[] = [
  'DROP INDEX IF EXISTS "IDX_edubridge_lessons_unique_course"',
  'DROP INDEX IF EXISTS "IDX_edubridge_lessons_unique_group"',
  'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_edubridge_lessons_unique" ON "edubridge_lessons" ("coopname", "course_id", "lesson_number")',
];

export class EdubridgeLessonUniquePerGroup1791700000000 implements MigrationInterface {
  name = 'EdubridgeLessonUniquePerGroup1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
