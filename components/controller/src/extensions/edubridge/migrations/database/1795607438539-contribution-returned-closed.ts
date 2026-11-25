import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Два состояния взноса преподавателя (расширение «edubridge»): «возвращён на
 * доработку» — взнос не принят, материалы у преподавателя, повторная подача
 * без срока; «закрыт без приёма» — расчёт закрыл кооператив. Расчёт занятия с
 * участниками ни одно из них не меняет (решение владельца 25.11.2026).
 */
const UP: readonly string[] = [
  `ALTER TYPE "public"."edubridge_contributions_status_enum" ADD VALUE IF NOT EXISTS 'returned'`,
  `ALTER TYPE "public"."edubridge_contributions_status_enum" ADD VALUE IF NOT EXISTS 'closed'`,
];

// Значение из перечисления PostgreSQL не убирается; обратного шага нет.
const DOWN: readonly string[] = [];

export class EdubridgeContributionReturnedClosed1795607438539 implements SchemaMigration {
  name = 'EdubridgeContributionReturnedClosed1795607438539';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
