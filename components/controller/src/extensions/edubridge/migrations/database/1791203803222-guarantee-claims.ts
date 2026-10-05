import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Заявления об аннулировании подписки по гарантийным условиям (расширение
 * «edubridge»): причина, подписанное заявление, вопрос в повестке совета и его
 * исход. На подписку — одно заявление.
 */
const UP: readonly string[] = [
  "CREATE TABLE IF NOT EXISTS \"edubridge_guarantee_claims\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"coopname\" character varying(13) NOT NULL, \"member_username\" character varying(13) NOT NULL, \"enrollment_id\" uuid NOT NULL, \"course_id\" uuid NOT NULL, \"claim_hash\" character varying(64) NOT NULL, \"reason\" text NOT NULL, \"links\" jsonb NOT NULL DEFAULT '[]', \"amount\" character varying(64) NOT NULL, \"status\" character varying(32) NOT NULL, \"statement_document\" jsonb NOT NULL, \"council_project_hash\" character varying(64), \"council_agenda_id\" character varying(32), \"council_decision_id\" character varying(32), \"decision_hash\" character varying(64), \"decided_at\" TIMESTAMP WITH TIME ZONE, \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"PK_edubridge_guarantee_claims\" PRIMARY KEY (\"id\"))",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"IDX_edubridge_guarantee_claims_enrollment\" ON \"edubridge_guarantee_claims\" (\"enrollment_id\")",
  "CREATE INDEX IF NOT EXISTS \"IDX_edubridge_guarantee_claims_coop_status\" ON \"edubridge_guarantee_claims\" (\"coopname\", \"status\")",
];

const DOWN: readonly string[] = ["DROP TABLE IF EXISTS \"edubridge_guarantee_claims\""];

export class EdubridgeGuaranteeClaims1791203803222 implements MigrationInterface {
  name = 'EdubridgeGuaranteeClaims1791203803222';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
