import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Подписанный акт передачи материалов на ответственное хранение (3012) целиком
 * в записи взноса (расширение «edubridge»): до сих пор хранился только его
 * хэш, и в карточке взноса документ показать было нечем — у заявления и акта
 * приёма-передачи документ в записи есть. У взносов, переданных на хранение
 * раньше, колонка остаётся пустой.
 */
const UP: readonly string[] = ['ALTER TABLE "edubridge_contributions" ADD COLUMN IF NOT EXISTS "storage_act_document" jsonb'];

const DOWN: readonly string[] = ['ALTER TABLE "edubridge_contributions" DROP COLUMN IF EXISTS "storage_act_document"'];

export class EdubridgeContributionStorageActDocument1791362839623 implements MigrationInterface {
  name = 'EdubridgeContributionStorageActDocument1791362839623';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
