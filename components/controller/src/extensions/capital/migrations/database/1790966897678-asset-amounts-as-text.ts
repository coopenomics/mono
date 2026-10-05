import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Суммы зеркал ссуд, инвестиций и расходов — строкой актива.
 *
 * Колонки были целочисленными (`bigint`), а цепь отдаёт сумму активом вида
 * «5033.0000 RUB»: вставка падала, и зеркала не писались вовсе (C28-85,
 * находка 59). Строк в таблицах поэтому нет; смена типа переносит значение
 * как текст.
 */
const UP: readonly string[] = [
  'ALTER TABLE "capital_debts" ALTER COLUMN "amount" TYPE character varying USING "amount"::text',
  'ALTER TABLE "capital_invests" ALTER COLUMN "amount" TYPE character varying USING "amount"::text',
  'ALTER TABLE "capital_invests" ALTER COLUMN "coordinator_amount" TYPE character varying USING "coordinator_amount"::text',
  'ALTER TABLE "capital_expenses" ALTER COLUMN "amount" TYPE character varying USING "amount"::text',
];

/** Назад — целая часть суммы: дробную часть и символ актива целочисленная колонка не хранит. */
const DOWN: readonly string[] = [
  'ALTER TABLE "capital_expenses" ALTER COLUMN "amount" TYPE bigint USING split_part(split_part("amount", \' \', 1), \'.\', 1)::bigint',
  'ALTER TABLE "capital_invests" ALTER COLUMN "coordinator_amount" TYPE bigint USING split_part(split_part("coordinator_amount", \' \', 1), \'.\', 1)::bigint',
  'ALTER TABLE "capital_invests" ALTER COLUMN "amount" TYPE bigint USING split_part(split_part("amount", \' \', 1), \'.\', 1)::bigint',
  'ALTER TABLE "capital_debts" ALTER COLUMN "amount" TYPE bigint USING split_part(split_part("amount", \' \', 1), \'.\', 1)::bigint',
];

export class CapitalAssetAmountsAsText1790966897678 implements MigrationInterface {
  name = 'CapitalAssetAmountsAsText1790966897678';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
