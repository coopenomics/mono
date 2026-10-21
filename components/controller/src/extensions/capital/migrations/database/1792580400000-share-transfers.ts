import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * История трансляций паевого взноса из Благороста в Цифровой Кошелёк
 * (`capital::wthshare`, заявление 1090): кто, сколько, каким заявлением и
 * какой транзакцией. Строка резервируется до отправки в цепь и
 * подтверждается после её ответа: уникальный индекс по хэшу заявления не
 * даёт отправить одно заявление дважды.
 */
const UP: readonly string[] = [
  "CREATE TABLE IF NOT EXISTS \"capital_share_transfers\" (\"_id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"coopname\" character varying(13) NOT NULL, \"username\" character varying(13) NOT NULL, \"amount\" character varying(64) NOT NULL, \"statement_hash\" character varying(64) NOT NULL, \"statement\" jsonb NOT NULL, \"transaction_id\" character varying(64) NOT NULL DEFAULT '', \"confirmed\" boolean NOT NULL DEFAULT false, \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"PK_capital_share_transfers\" PRIMARY KEY (\"_id\"))",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"IDX_capital_share_transfers_statement\" ON \"capital_share_transfers\" (\"statement_hash\")",
  "CREATE INDEX IF NOT EXISTS \"IDX_capital_share_transfers_user\" ON \"capital_share_transfers\" (\"coopname\", \"username\", \"created_at\")",
];

const DOWN: readonly string[] = ["DROP TABLE IF EXISTS \"capital_share_transfers\""];

export class CapitalShareTransfers1792580400000 implements MigrationInterface {
  name = 'CapitalShareTransfers1792580400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
