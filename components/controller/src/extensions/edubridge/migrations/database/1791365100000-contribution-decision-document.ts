import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Протокол совета о приёме паевого взноса РИД (3009) целиком в записи взноса
 * (расширение «edubridge»): повестку теперь ставит контракт, совет подписывает
 * протокол по заявлению, и он приходит обратным вызовом `onridauth`. Этим
 * документом закрываются приём и отказ. У взносов, прошедших совет раньше,
 * колонка пуста — протокол для них собирается по номеру решения, как прежде.
 */
const UP: readonly string[] = ['ALTER TABLE "edubridge_contributions" ADD COLUMN IF NOT EXISTS "decision_document" jsonb'];

const DOWN: readonly string[] = ['ALTER TABLE "edubridge_contributions" DROP COLUMN IF EXISTS "decision_document"'];

export class EdubridgeContributionDecisionDocument1791365100000 implements MigrationInterface {
  name = 'EdubridgeContributionDecisionDocument1791365100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
