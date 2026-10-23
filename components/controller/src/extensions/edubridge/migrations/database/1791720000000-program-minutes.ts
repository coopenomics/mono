import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Учёт программы в минутах (расширение «edubridge»). Администратор задаёт окна
 * расписания и длительность программы в месяцах; минуты занятий в месяц и в
 * программе считает сервер из окон, контракт ведёт оплату и расчёт в минутах.
 * Прежние числа занятий остаются для показа и заполняются из минут.
 */
const TABLES = ['edubridge_courses', 'edubridge_groups'] as const;

const UP: readonly string[] = TABLES.flatMap((t) => [
  `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "program_months" integer NOT NULL DEFAULT 0`,
  `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "minutes_per_month" integer NOT NULL DEFAULT 0`,
  `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "minutes_total" integer NOT NULL DEFAULT 0`,
  `UPDATE "${t}" SET "minutes_per_month" = "lessons_per_month" * "lesson_minutes", "minutes_total" = "lessons_total" * "lesson_minutes", "program_months" = CASE WHEN "lessons_per_month" > 0 AND "lessons_total" > 0 THEN CEIL("lessons_total"::numeric / "lessons_per_month") ELSE 0 END WHERE "minutes_per_month" = 0`,
]);

const DOWN: readonly string[] = TABLES.flatMap((t) => [
  `ALTER TABLE "${t}" DROP COLUMN IF EXISTS "minutes_total"`,
  `ALTER TABLE "${t}" DROP COLUMN IF EXISTS "minutes_per_month"`,
  `ALTER TABLE "${t}" DROP COLUMN IF EXISTS "program_months"`,
]);

export class EdubridgeProgramMinutes1791720000000 implements MigrationInterface {
  name = 'EdubridgeProgramMinutes1791720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
