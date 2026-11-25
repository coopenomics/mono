import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Причина отклонения решения совета — текст председателя, только в базе узла.
 *
 * Отклонение по большинству «против» (`soviet::declinedec`) несёт в цепи одну
 * общую фразу «большинство голосов против». Председатель может пояснить отказ
 * своими словами (решение владельца 25.11.2026); в цепь пояснение не пишется,
 * хранится здесь и читается расширениями по номеру решения через порт
 * DECISION_DECLINE_REASON_PORT — например, преподаватель видит его в отчёте.
 */
const UP: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "decision_decline_reasons" (
    "coopname" character varying(13) NOT NULL,
    "decision_id" bigint NOT NULL,
    "reason" text NOT NULL,
    "declined_by" character varying(13),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT "PK_decision_decline_reasons" PRIMARY KEY ("coopname", "decision_id")
  )`,
  `COMMENT ON TABLE "decision_decline_reasons" IS 'Пояснение председателя к отклонению решения совета; в цепь не пишется'`,
];

const DOWN: readonly string[] = [`DROP TABLE IF EXISTS "decision_decline_reasons"`];

export class CoreDecisionDeclineReasons1795596709426 implements SchemaMigration {
  name = 'CoreDecisionDeclineReasons1795596709426';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
