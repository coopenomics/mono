import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Денежные расчёты образования ведёт контракт (расширение «edubridge»).
 * Курс получает способ расчёта с преподавателем: за каждого участника либо
 * фиксированный за занятие — прежние курсы остаются на фиксированном. Допуск
 * получает числовой номер для таблицы допусков в цепи. Занятие хранит число
 * участников, по которым контракт провёл расчёт.
 */
const UP: readonly string[] = [
  "ALTER TABLE \"edubridge_courses\" ADD COLUMN IF NOT EXISTS \"pay_per_learner\" boolean NOT NULL DEFAULT false",
  "ALTER TABLE \"edubridge_teacher_assignments\" ADD COLUMN IF NOT EXISTS \"chain_ref\" BIGSERIAL NOT NULL",
  "ALTER TABLE \"edubridge_lessons\" ADD COLUMN IF NOT EXISTS \"learners_count\" integer",
];

const DOWN: readonly string[] = [
  "ALTER TABLE \"edubridge_lessons\" DROP COLUMN IF EXISTS \"learners_count\"",
  "ALTER TABLE \"edubridge_teacher_assignments\" DROP COLUMN IF EXISTS \"chain_ref\"",
  "ALTER TABLE \"edubridge_courses\" DROP COLUMN IF EXISTS \"pay_per_learner\"",
];

export class EdubridgeChainEconomy1791443921510 implements MigrationInterface {
  name = 'EdubridgeChainEconomy1791443921510';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
