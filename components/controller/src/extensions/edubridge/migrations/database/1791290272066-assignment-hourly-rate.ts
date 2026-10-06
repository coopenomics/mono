import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Ставка часа преподавателя на конкретном курсе (расширение «edubridge»): у
 * допуска к курсу своя ставка. Действующим допускам проставляется ставка из
 * договора преподавателя, но не выше плановой ставки курса — взнос учеников
 * посчитан от плановой.
 */
const UP: readonly string[] = [
  "ALTER TABLE \"edubridge_teacher_assignments\" ADD COLUMN IF NOT EXISTS \"hourly_rate\" character varying(64) NOT NULL DEFAULT '0.0000 RUB'",
  "UPDATE \"edubridge_teacher_assignments\" a SET \"hourly_rate\" = CASE WHEN split_part(c.\"hourly_rate\", ' ', 1)::numeric > split_part(k.\"planned_hourly_rate\", ' ', 1)::numeric THEN k.\"planned_hourly_rate\" ELSE c.\"hourly_rate\" END FROM \"edubridge_teacher_contracts\" c, \"edubridge_courses\" k WHERE c.\"coopname\" = a.\"coopname\" AND c.\"teacher_username\" = a.\"teacher_username\" AND k.\"id\" = a.\"course_id\" AND a.\"hourly_rate\" = '0.0000 RUB'",
];

const DOWN: readonly string[] = ["ALTER TABLE \"edubridge_teacher_assignments\" DROP COLUMN IF EXISTS \"hourly_rate\""];

export class EdubridgeAssignmentHourlyRate1791290272066 implements MigrationInterface {
  name = 'EdubridgeAssignmentHourlyRate1791290272066';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
