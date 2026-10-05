import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Подписанный документ договора участия в хозяйственной деятельности
 * (расширение «edubridge»): сначала с подписью преподавателя, после одобрения —
 * с подписью председателя. По нему договор можно открыть в любой момент.
 */
const UP: readonly string[] = ['ALTER TABLE "edubridge_teacher_contracts" ADD COLUMN IF NOT EXISTS "contract_document" jsonb'];

const DOWN: readonly string[] = ['ALTER TABLE "edubridge_teacher_contracts" DROP COLUMN IF EXISTS "contract_document"'];

export class EdubridgeContractDocument1791201979422 implements MigrationInterface {
  name = 'EdubridgeContractDocument1791201979422';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
