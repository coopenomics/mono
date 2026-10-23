import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Длительность программы с шагом в неделю (расширение «edubridge»). Месяц —
 * четыре недели, программа может длиться три месяца и две недели: колонка
 * месяцев хранит четверти (3.5). Тип с плавающей точкой: четверти в нём точны,
 * и драйвер отдаёт число, а не строку.
 */
const TABLES = ['edubridge_courses', 'edubridge_groups'] as const;

const UP: readonly string[] = TABLES.map((t) => `ALTER TABLE "${t}" ALTER COLUMN "program_months" TYPE double precision`);

const DOWN: readonly string[] = TABLES.map((t) => `ALTER TABLE "${t}" ALTER COLUMN "program_months" TYPE integer USING ceil("program_months")::integer`);

export class EdubridgeProgramMonthsWeeks1791740000000 implements MigrationInterface {
  name = 'EdubridgeProgramMonthsWeeks1791740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
