import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Дата создания записи в зеркалах ссуд, инвестиций и расходов — необязательная.
 *
 * Цепь даты создания записи не хранит, и колонку никто не заполнял: обязательная
 * колонка роняла вставку, зеркала не писались (C28-85, находка 59). Время
 * появления записи в базе ведёт `_created_at`.
 */
const UP: readonly string[] = [
  'ALTER TABLE "capital_debts" ALTER COLUMN "created_at" DROP NOT NULL',
  'ALTER TABLE "capital_invests" ALTER COLUMN "created_at" DROP NOT NULL',
  'ALTER TABLE "capital_expenses" ALTER COLUMN "created_at" DROP NOT NULL',
];

const DOWN: readonly string[] = [
  'UPDATE "capital_expenses" SET "created_at" = "_created_at" WHERE "created_at" IS NULL',
  'UPDATE "capital_invests" SET "created_at" = "_created_at" WHERE "created_at" IS NULL',
  'UPDATE "capital_debts" SET "created_at" = "_created_at" WHERE "created_at" IS NULL',
  'ALTER TABLE "capital_expenses" ALTER COLUMN "created_at" SET NOT NULL',
  'ALTER TABLE "capital_invests" ALTER COLUMN "created_at" SET NOT NULL',
  'ALTER TABLE "capital_debts" ALTER COLUMN "created_at" SET NOT NULL',
];

export class CapitalMirrorCreatedAtOptional1790971648531 implements MigrationInterface {
  name = 'CapitalMirrorCreatedAtOptional1790971648531';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
