import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Администраторы образования переезжают в общие назначения ролей (C28-90).
 *
 * Раньше их вёл собственный список приложения. Теперь роль «администратор
 * образования» председатель назначает на странице управления доступом, а
 * приложение читает держателей оттуда. Действующие администраторы переносятся
 * с тем же назначившим и той же датой — доступ никто не теряет; список
 * приложения после переноса удаляется.
 */
export class EdubridgeAdminsToRoleAssignments1791629940202 implements MigrationInterface {
  name = 'EdubridgeAdminsToRoleAssignments1791629940202';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "role_assignments" ("coopname", "username", "extension_name", "role", "assigned_by", "assigned_at")
       SELECT a."coopname", a."username", 'edubridge', 'edu-admin', a."appointed_by", a."created_at"
       FROM "edubridge_admins" a
       WHERE NOT EXISTS (
         SELECT 1 FROM "role_assignments" r
         WHERE r."coopname" = a."coopname" AND r."username" = a."username" AND r."role" = 'edu-admin' AND r."revoked_at" IS NULL
       )`
    );
    await queryRunner.query('DROP TABLE "edubridge_admins"');
  }

  public async down(): Promise<void> {
    throw new Error('EdubridgeAdminsToRoleAssignments1791629940202 не откатывается: список администраторов приложения удалён, назначения живут в общих ролях');
  }
}
