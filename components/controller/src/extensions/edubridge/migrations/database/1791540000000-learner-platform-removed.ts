import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Отметка администратора «аккаунт обучающегося удалён с площадки» (расширение
 * «edubridge»). Площадки не дают удалить аккаунт по API: администратор удаляет
 * его в кабинете школы и отмечает это здесь. Новая выдача доступа отметку снимает.
 */
const UP: readonly string[] = ["ALTER TABLE \"edubridge_learners\" ADD COLUMN IF NOT EXISTS \"platform_removed_at\" TIMESTAMP WITH TIME ZONE"];

const DOWN: readonly string[] = ["ALTER TABLE \"edubridge_learners\" DROP COLUMN IF EXISTS \"platform_removed_at\""];

export class EdubridgeLearnerPlatformRemoved1791540000000 implements MigrationInterface {
  name = 'EdubridgeLearnerPlatformRemoved1791540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
