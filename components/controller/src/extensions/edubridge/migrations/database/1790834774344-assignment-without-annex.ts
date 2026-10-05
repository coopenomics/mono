import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Допуск преподавателя к курсу без приложения к договору (таблица назначений
 * расширения «edubridge»): уходят хэш приложения и причина отказа в его
 * подписи, у назначения остаются два состояния — действует и закрыто.
 *
 * SQL выписан TypeORM из сущностей (`pnpm schema:generate`); приведение
 * статуса дописано руками — прежние значения переводятся в новые: черновик и
 * назначение на подписи у председателя становятся действующим допуском,
 * отклонённое — закрытым.
 */
const UP: readonly string[] = [
  "ALTER TABLE \"edubridge_teacher_assignments\" DROP COLUMN \"decline_reason\"",
  "ALTER TABLE \"edubridge_teacher_assignments\" DROP COLUMN \"annex_hash\"",
  "ALTER TYPE \"public\".\"edubridge_teacher_assignments_status_enum\" RENAME TO \"edubridge_teacher_assignments_status_enum_old\"",
  "CREATE TYPE \"public\".\"edubridge_teacher_assignments_status_enum\" AS ENUM('active', 'closed')",
  "ALTER TABLE \"edubridge_teacher_assignments\" ALTER COLUMN \"status\" DROP DEFAULT",
  "ALTER TABLE \"edubridge_teacher_assignments\" ALTER COLUMN \"status\" TYPE \"public\".\"edubridge_teacher_assignments_status_enum\" USING (CASE \"status\"::\"text\" WHEN 'closed' THEN 'closed' WHEN 'declined' THEN 'closed' ELSE 'active' END)::\"public\".\"edubridge_teacher_assignments_status_enum\"",
  "ALTER TABLE \"edubridge_teacher_assignments\" ALTER COLUMN \"status\" SET DEFAULT 'active'",
  "DROP TYPE \"public\".\"edubridge_teacher_assignments_status_enum_old\"",
];

const DOWN: readonly string[] = [
  "CREATE TYPE \"public\".\"edubridge_teacher_assignments_status_enum_old\" AS ENUM('draft', 'pending_approval', 'active', 'declined', 'closed')",
  "ALTER TABLE \"edubridge_teacher_assignments\" ALTER COLUMN \"status\" DROP DEFAULT",
  "ALTER TABLE \"edubridge_teacher_assignments\" ALTER COLUMN \"status\" TYPE \"public\".\"edubridge_teacher_assignments_status_enum_old\" USING \"status\"::\"text\"::\"public\".\"edubridge_teacher_assignments_status_enum_old\"",
  "ALTER TABLE \"edubridge_teacher_assignments\" ALTER COLUMN \"status\" SET DEFAULT 'draft'",
  "DROP TYPE \"public\".\"edubridge_teacher_assignments_status_enum\"",
  "ALTER TYPE \"public\".\"edubridge_teacher_assignments_status_enum_old\" RENAME TO \"edubridge_teacher_assignments_status_enum\"",
  "ALTER TABLE \"edubridge_teacher_assignments\" ADD \"annex_hash\" character varying(64)",
  "ALTER TABLE \"edubridge_teacher_assignments\" ADD \"decline_reason\" text NOT NULL DEFAULT ''",
];

export class EdubridgeAssignmentWithoutAnnex1790834774344 implements MigrationInterface {
  name = 'EdubridgeAssignmentWithoutAnnex1790834774344';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
