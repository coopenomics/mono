import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Роль «Кассир» переезжает со стола совета на стол кассира.
 *
 * Назначение хранит приложение, за которым числится роль. Права пайщику
 * считаются по ключу роли, поэтому действующие кассиры доступ не теряют и без
 * этой правки; правка выравнивает записи с объявлением, чтобы история выдачи
 * доступа называла тот стол, на котором кассир работает.
 */
export class CashierRoleToCashierDesk1792132849961 implements MigrationInterface {
  name = 'CashierRoleToCashierDesk1792132849961';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role_assignments" SET "extension_name" = 'cashier' WHERE "role" = 'cashier' AND "extension_name" = 'soviet'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role_assignments" SET "extension_name" = 'soviet' WHERE "role" = 'cashier' AND "extension_name" = 'cashier'`
    );
  }
}
