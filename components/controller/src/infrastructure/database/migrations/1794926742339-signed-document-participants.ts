import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Участники пакета документов (решение владельца 17.11.2026): пакет процесса
 * в реестре один — заявление, решение совета, акты и связанные документы, — а
 * пайщику выдаются только те документы пакета, которые ему полагаются: где он
 * субъект документа или подписант. Совет видит пакет целиком.
 *
 * `participants` — все, кто в пакете субъект (meta.username) или подписант, и
 * владелец заявления. Реестр отбирает пакеты пайщика по владельцу или по
 * вхождению в участники (индекс GIN), а состав пакета узел режет при выдаче.
 * Записи, собранные раньше, заполняются из сохранённого агрегата пакета.
 */
const UP: readonly string[] = [
  `ALTER TABLE "signed_documents" ADD COLUMN IF NOT EXISTS "participants" text[] NOT NULL DEFAULT '{}'`,
  `UPDATE "signed_documents" SET "participants" = ARRAY(
     SELECT DISTINCT v FROM (
       SELECT "signed_documents"."username" AS v
       UNION ALL
       SELECT jsonb_path_query("signed_documents"."document_aggregate"::jsonb, 'lax $.**.signatures[*].signer') #>> '{}'
       UNION ALL
       SELECT jsonb_path_query("signed_documents"."document_aggregate"::jsonb, 'lax $.**.meta.username') #>> '{}'
     ) s WHERE v IS NOT NULL AND v <> ''
   )
   WHERE "document_aggregate" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "IDX_signed_documents_participants" ON "signed_documents" USING GIN ("participants")`,
];

const DOWN: readonly string[] = [
  `DROP INDEX IF EXISTS "IDX_signed_documents_participants"`,
  `ALTER TABLE "signed_documents" DROP COLUMN IF EXISTS "participants"`,
];

export class CoreSignedDocumentParticipants1794926742339 implements SchemaMigration {
  name = 'CoreSignedDocumentParticipants1794926742339';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
