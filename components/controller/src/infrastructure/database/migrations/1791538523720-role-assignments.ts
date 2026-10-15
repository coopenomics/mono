import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Назначения ролей пайщикам (C28-90).
 *
 * Роль объявляет приложение, ядро хранит связь «роль — пайщик»: кто назначил
 * и когда, кто снял и когда. Строка без отметки снятия — действующее
 * назначение; у пайщика одно действующее назначение на роль. Снятые строки
 * остаются историей выдачи доступа.
 */
export class RoleAssignments1791538523720 implements MigrationInterface {
  name = 'RoleAssignments1791538523720';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "role_assignments" ("id" SERIAL NOT NULL, "coopname" character varying NOT NULL, "username" character varying NOT NULL, "extension_name" character varying NOT NULL, "role" character varying NOT NULL, "assigned_by" character varying NOT NULL, "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "revoked_by" character varying, "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_role_assignments" PRIMARY KEY ("id"))'
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_role_assignments_active" ON "role_assignments" ("coopname", "username", "role") WHERE "revoked_at" IS NULL'
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_role_assignments_role_active" ON "role_assignments" ("coopname", "role") WHERE "revoked_at" IS NULL'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "role_assignments"');
  }
}
