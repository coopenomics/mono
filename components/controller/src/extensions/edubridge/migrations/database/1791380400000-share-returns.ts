import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Возвраты паевого взноса преподавателя (расширение «edubridge»): одной
 * кнопкой со стола расчёта подписываются заявление о трансляции в Цифровой
 * Кошелёк (3015) и заявление о возврате (900). Платёж ведёт шлюз, здесь —
 * связка платежа с преподавателем и оба заявления для его выписки.
 */
const UP: readonly string[] = [
  "CREATE TABLE IF NOT EXISTS \"edubridge_share_returns\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"coopname\" character varying(13) NOT NULL, \"teacher_username\" character varying(13) NOT NULL, \"amount\" character varying(64) NOT NULL, \"payment_hash\" character varying(64) NOT NULL, \"transfer_statement_document\" jsonb NOT NULL, \"return_statement_document\" jsonb NOT NULL, \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"PK_edubridge_share_returns\" PRIMARY KEY (\"id\"))",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"IDX_edubridge_share_returns_payment\" ON \"edubridge_share_returns\" (\"payment_hash\")",
  "CREATE INDEX IF NOT EXISTS \"IDX_edubridge_share_returns_teacher\" ON \"edubridge_share_returns\" (\"coopname\", \"teacher_username\")",
];

const DOWN: readonly string[] = ["DROP TABLE IF EXISTS \"edubridge_share_returns\""];

export class EdubridgeShareReturns1791380400000 implements MigrationInterface {
  name = 'EdubridgeShareReturns1791380400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
