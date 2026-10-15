import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Набор в группу закрывается сам с дня начала занятий (расширение «edubridge»).
 * Отметка говорит, что закрытие по началу уже состоялось: после неё набор ведёт
 * администратор и может открыть его снова, чтобы принять участника в идущую
 * группу. Перенос начала на будущий день отметку снимает.
 */
const UP: readonly string[] = [
  "ALTER TABLE \"edubridge_groups\" ADD COLUMN IF NOT EXISTS \"enrollment_closed_on_start\" boolean NOT NULL DEFAULT false",
];

const DOWN: readonly string[] = ["ALTER TABLE \"edubridge_groups\" DROP COLUMN IF EXISTS \"enrollment_closed_on_start\""];

export class EdubridgeGroupEnrollmentClosedOnStart1791530000000 implements MigrationInterface {
  name = 'EdubridgeGroupEnrollmentClosedOnStart1791530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
