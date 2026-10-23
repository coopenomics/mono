import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Календарь занятий (расширение «edubridge»). Расписание курса и группы
 * задаётся окнами: день недели, время начала, длительность, преподаватель.
 * Из окон и даты начала строится календарь: занятия появляются в журнале
 * заранее со статусом «запланировано», отчёт преподавателя переводит их в
 * «проведено». Срок на отчёт — дней после занятия, задаёт курс.
 *
 * Номер занятия уникален среди незавершённых занятий группы: отменённое
 * занятие номер освобождает, и его занимает дополнительное.
 */
const UP: readonly string[] = [
  'ALTER TABLE "edubridge_courses" ADD COLUMN IF NOT EXISTS "schedule_slots" jsonb NOT NULL DEFAULT \'[]\'',
  'ALTER TABLE "edubridge_courses" ADD COLUMN IF NOT EXISTS "report_days" integer NOT NULL DEFAULT 7',
  'ALTER TABLE "edubridge_groups" ADD COLUMN IF NOT EXISTS "schedule_slots" jsonb NOT NULL DEFAULT \'[]\'',
  'ALTER TABLE "edubridge_groups" ADD COLUMN IF NOT EXISTS "report_days" integer NOT NULL DEFAULT 7',
  'ALTER TABLE "edubridge_lessons" ALTER COLUMN "assignment_id" DROP NOT NULL',
  'ALTER TABLE "edubridge_lessons" ALTER COLUMN "teacher_username" DROP NOT NULL',
  'ALTER TABLE "edubridge_lessons" ADD COLUMN IF NOT EXISTS "status" character varying(16) NOT NULL DEFAULT \'held\'',
  'ALTER TABLE "edubridge_lessons" ADD COLUMN IF NOT EXISTS "origin" character varying(16) NOT NULL DEFAULT \'schedule\'',
  'ALTER TABLE "edubridge_lessons" ADD COLUMN IF NOT EXISTS "reported_at" TIMESTAMP WITH TIME ZONE',
  'UPDATE "edubridge_lessons" SET "reported_at" = "created_at" WHERE "reported_at" IS NULL AND "status" = \'held\'',
  'DROP INDEX IF EXISTS "IDX_edubridge_lessons_unique_group"',
  'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_edubridge_lessons_unique_group" ON "edubridge_lessons" ("coopname", "group_id", "lesson_number") WHERE "group_id" IS NOT NULL AND "status" <> \'cancelled\'',
  'CREATE INDEX IF NOT EXISTS "IDX_edubridge_lessons_held_at" ON "edubridge_lessons" ("coopname", "held_at")',
];

const DOWN: readonly string[] = [
  'DROP INDEX IF EXISTS "IDX_edubridge_lessons_held_at"',
  'DROP INDEX IF EXISTS "IDX_edubridge_lessons_unique_group"',
  'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_edubridge_lessons_unique_group" ON "edubridge_lessons" ("coopname", "group_id", "lesson_number") WHERE "group_id" IS NOT NULL',
  'ALTER TABLE "edubridge_lessons" DROP COLUMN IF EXISTS "reported_at"',
  'ALTER TABLE "edubridge_lessons" DROP COLUMN IF EXISTS "origin"',
  'ALTER TABLE "edubridge_lessons" DROP COLUMN IF EXISTS "status"',
  'ALTER TABLE "edubridge_lessons" ALTER COLUMN "teacher_username" SET NOT NULL',
  'ALTER TABLE "edubridge_lessons" ALTER COLUMN "assignment_id" SET NOT NULL',
  'ALTER TABLE "edubridge_groups" DROP COLUMN IF EXISTS "report_days"',
  'ALTER TABLE "edubridge_groups" DROP COLUMN IF EXISTS "schedule_slots"',
  'ALTER TABLE "edubridge_courses" DROP COLUMN IF EXISTS "report_days"',
  'ALTER TABLE "edubridge_courses" DROP COLUMN IF EXISTS "schedule_slots"',
];

export class EdubridgeLessonCalendar1791710000000 implements MigrationInterface {
  name = 'EdubridgeLessonCalendar1791710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
