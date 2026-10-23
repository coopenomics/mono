import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Момент начала занятий группы с точностью до минуты (расширение «edubridge»).
 * В работе начало — дата, колонка пуста. На стенде разработки со сжатым
 * временем администратор называет «начало через N минут»: момент хранится
 * здесь, от него идут закрытие набора, гарантийный срок и срок программы.
 */
const UP: readonly string[] = ["ALTER TABLE \"edubridge_groups\" ADD COLUMN IF NOT EXISTS \"starts_at_time\" TIMESTAMP WITH TIME ZONE"];

const DOWN: readonly string[] = ["ALTER TABLE \"edubridge_groups\" DROP COLUMN IF EXISTS \"starts_at_time\""];

export class EdubridgeGroupStartMoment1791640000000 implements MigrationInterface {
  name = 'EdubridgeGroupStartMoment1791640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
