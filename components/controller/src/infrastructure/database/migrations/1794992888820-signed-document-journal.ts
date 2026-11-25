import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Журнал документов (решение владельца 18.11.2026): реестр хранит строку на
 * каждый подписанный документ, а пакет процесса — группировка поверх строк.
 *
 * - `role` — роль документа в процессе: заявление (statement), решение совета
 *   (decision), акт (act), связанный документ (link), соглашение, которое
 *   заявление перечисляет в своих связях (agreement). Прежние строки — заявления:
 *   до журнала узел писал строки только для них.
 * - `signed_at` — время блока, в котором документ попал в цепь. Есть у каждого
 *   документа, по нему реестр сортирует и фильтрует период. Прежние строки
 *   берут время из сохранённого действия, иначе — дату из меты документа.
 * - `links` — хэши документов, которые заявление перечисляет в meta.links
 *   (соглашения при вступлении). По ним узел кладёт такое соглашение в пакет
 *   заявления, а не отдельным пакетом.
 *
 * Пакеты прежних строк не меняются (слово владельца: старое не перекладываем).
 */
const UP: readonly string[] = [
  `ALTER TABLE "signed_documents" ADD COLUMN IF NOT EXISTS "role" varchar(16) NOT NULL DEFAULT 'statement'`,
  `ALTER TABLE "signed_documents" ADD COLUMN IF NOT EXISTS "signed_at" timestamptz NULL`,
  `ALTER TABLE "signed_documents" ADD COLUMN IF NOT EXISTS "links" text[] NOT NULL DEFAULT '{}'`,
  `UPDATE "signed_documents" SET "signed_at" = COALESCE(
     NULLIF("source_action_data"::jsonb ->> 'block_time', '')::timestamptz,
     "document_created_at",
     "created_at"
   )
   WHERE "signed_at" IS NULL`,
  `UPDATE "signed_documents" SET "links" = ARRAY(
     SELECT DISTINCT upper(v) FROM (
       SELECT jsonb_path_query("document_aggregate"::jsonb, 'lax $.statement.documentAggregate.document.meta.links[*]') #>> '{}' AS v
     ) s WHERE v IS NOT NULL AND v <> ''
   )
   WHERE "document_aggregate" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "IDX_signed_documents_package" ON "signed_documents" ("coopname", "package")`,
  `CREATE INDEX IF NOT EXISTS "IDX_signed_documents_signed_at" ON "signed_documents" ("coopname", "signed_at" DESC)`,
  `CREATE INDEX IF NOT EXISTS "IDX_signed_documents_registry" ON "signed_documents" ("coopname", "registry_id")`,
  `CREATE INDEX IF NOT EXISTS "IDX_signed_documents_role" ON "signed_documents" ("coopname", "role")`,
  `CREATE INDEX IF NOT EXISTS "IDX_signed_documents_links" ON "signed_documents" USING GIN ("links")`,
];

const DOWN: readonly string[] = [
  `DROP INDEX IF EXISTS "IDX_signed_documents_links"`,
  `DROP INDEX IF EXISTS "IDX_signed_documents_role"`,
  `DROP INDEX IF EXISTS "IDX_signed_documents_registry"`,
  `DROP INDEX IF EXISTS "IDX_signed_documents_signed_at"`,
  `DROP INDEX IF EXISTS "IDX_signed_documents_package"`,
  `ALTER TABLE "signed_documents" DROP COLUMN IF EXISTS "links"`,
  `ALTER TABLE "signed_documents" DROP COLUMN IF EXISTS "signed_at"`,
  `ALTER TABLE "signed_documents" DROP COLUMN IF EXISTS "role"`,
];

export class CoreSignedDocumentJournal1794992888820 implements SchemaMigration {
  name = 'CoreSignedDocumentJournal1794992888820';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
