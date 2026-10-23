import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Подписка уникальна в группе, а не на курсе (расширение «edubridge»).
 * Обучающийся, закончивший одну группу курса, записывается в следующую:
 * прежний ключ «обучающийся + курс» вторую подписку не пускал — взнос в цепи
 * проходил, а запись на узле не сохранялась. Подписки без группы (заведённые
 * до групп) остаются уникальными на курсе.
 */
const UP: readonly string[] = [
  'DROP INDEX IF EXISTS "IDX_edubridge_enrollments_unique"',
  'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_edubridge_enrollments_unique_group" ON "edubridge_enrollments" ("coopname", "learner_id", "group_id") WHERE "group_id" IS NOT NULL',
  'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_edubridge_enrollments_unique_course" ON "edubridge_enrollments" ("coopname", "learner_id", "course_id") WHERE "group_id" IS NULL',
];

const DOWN: readonly string[] = [
  'DROP INDEX IF EXISTS "IDX_edubridge_enrollments_unique_group"',
  'DROP INDEX IF EXISTS "IDX_edubridge_enrollments_unique_course"',
  'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_edubridge_enrollments_unique" ON "edubridge_enrollments" ("coopname", "learner_id", "course_id")',
];

export class EdubridgeEnrollmentUniquePerGroup1791650000000 implements MigrationInterface {
  name = 'EdubridgeEnrollmentUniquePerGroup1791650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
