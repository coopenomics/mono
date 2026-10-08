import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Группа — единица расчёта образования (расширение «edubridge»). Курс остаётся
 * программой с условиями по умолчанию; набор идёт в группу, и у каждой группы
 * свои дата начала, условия на момент открытия, привязка к группе площадки,
 * подписки, занятия и учёт средств. Две группы одного курса идут одновременно и не пересекаются.
 *
 * Каждому имеющемуся курсу заводится первая группа с тем же номером для цепи:
 * учёт курса в контракте остаётся её учётом. Подписки и занятия привязываются
 * к ней.
 */
const UP: readonly string[] = [
  "CREATE TABLE IF NOT EXISTS \"edubridge_groups\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"coopname\" character varying(13) NOT NULL, \"chain_ref\" BIGSERIAL NOT NULL, \"course_id\" uuid NOT NULL, \"title\" character varying(255) NOT NULL, \"status\" character varying(16) NOT NULL DEFAULT 'active', \"enrollment_open\" boolean NOT NULL DEFAULT true, \"external_ref\" character varying(255) NOT NULL DEFAULT '', \"starts_at\" date, \"lessons_per_month\" integer NOT NULL DEFAULT '0', \"lessons_total\" integer NOT NULL DEFAULT '0', \"lesson_minutes\" integer NOT NULL DEFAULT '60', \"planned_hourly_rate\" character varying(64) NOT NULL DEFAULT '0.0000 RUB', \"pay_per_learner\" boolean NOT NULL DEFAULT false, \"guarantee_days\" integer NOT NULL DEFAULT '14', \"course_payment_enabled\" boolean NOT NULL DEFAULT false, \"course_discount_bp\" integer NOT NULL DEFAULT '0', \"fee_month\" character varying(64) NOT NULL, \"teacher_reserve_balance\" character varying(64), \"teacher_settled_total\" character varying(64), \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"UQ_edubridge_groups_chain_ref\" UNIQUE (\"chain_ref\"), CONSTRAINT \"PK_edubridge_groups\" PRIMARY KEY (\"id\"))",
  "CREATE INDEX IF NOT EXISTS \"IDX_edubridge_groups_course\" ON \"edubridge_groups\" (\"coopname\", \"course_id\")",
  "INSERT INTO \"edubridge_groups\" (\"coopname\", \"chain_ref\", \"course_id\", \"title\", \"external_ref\", \"starts_at\", \"lessons_per_month\", \"lessons_total\", \"lesson_minutes\", \"planned_hourly_rate\", \"pay_per_learner\", \"guarantee_days\", \"course_payment_enabled\", \"course_discount_bp\", \"fee_month\", \"teacher_reserve_balance\", \"teacher_settled_total\") SELECT c.\"coopname\", c.\"chain_ref\", c.\"id\", 'Группа 1', c.\"external_ref\", c.\"starts_at\", c.\"lessons_per_month\", c.\"lessons_total\", c.\"lesson_minutes\", c.\"planned_hourly_rate\", c.\"pay_per_learner\", c.\"guarantee_days\", c.\"course_payment_enabled\", c.\"course_discount_bp\", c.\"fee_month\", c.\"teacher_reserve_balance\", c.\"teacher_settled_total\" FROM \"edubridge_courses\" c WHERE NOT EXISTS (SELECT 1 FROM \"edubridge_groups\" g WHERE g.\"course_id\" = c.\"id\")",
  "SELECT setval(pg_get_serial_sequence('edubridge_groups', 'chain_ref'), GREATEST((SELECT COALESCE(MAX(\"chain_ref\"), 0) FROM \"edubridge_groups\"), (SELECT COALESCE(MAX(\"chain_ref\"), 0) FROM \"edubridge_courses\")) + 1000)",
  "ALTER TABLE \"edubridge_enrollments\" ADD COLUMN IF NOT EXISTS \"group_id\" uuid",
  "UPDATE \"edubridge_enrollments\" e SET \"group_id\" = g.\"id\" FROM \"edubridge_groups\" g WHERE g.\"course_id\" = e.\"course_id\" AND e.\"group_id\" IS NULL",
  "ALTER TABLE \"edubridge_lessons\" ADD COLUMN IF NOT EXISTS \"group_id\" uuid",
  "UPDATE \"edubridge_lessons\" l SET \"group_id\" = g.\"id\" FROM \"edubridge_groups\" g WHERE g.\"course_id\" = l.\"course_id\" AND l.\"group_id\" IS NULL",
  "CREATE INDEX IF NOT EXISTS \"IDX_edubridge_enrollments_group\" ON \"edubridge_enrollments\" (\"coopname\", \"group_id\")",
  "CREATE INDEX IF NOT EXISTS \"IDX_edubridge_lessons_group\" ON \"edubridge_lessons\" (\"coopname\", \"group_id\")",
];

const DOWN: readonly string[] = [
  "DROP INDEX IF EXISTS \"IDX_edubridge_lessons_group\"",
  "DROP INDEX IF EXISTS \"IDX_edubridge_enrollments_group\"",
  "ALTER TABLE \"edubridge_lessons\" DROP COLUMN IF EXISTS \"group_id\"",
  "ALTER TABLE \"edubridge_enrollments\" DROP COLUMN IF EXISTS \"group_id\"",
  "DROP TABLE IF EXISTS \"edubridge_groups\"",
];

export class EdubridgeGroups1791447267515 implements MigrationInterface {
  name = 'EdubridgeGroups1791447267515';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
