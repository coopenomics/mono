/**
 * Схема хранилища фабрики в PostgreSQL — текущий вид трёх таблиц.
 *
 * На узлах таблицы создаёт миграция контроллера
 * `CoreFactoryStorage1793204380830` (снимок этой схемы на 28.10.2026;
 * миграции неизменны, правка схемы — новая миграция контроллера и правка
 * здесь). Этот перечень нужен тем, у кого мигратора контроллера нет: набору
 * тестов фабрики и отдельным стендам. Все команды идемпотентны.
 */
export const FACTORY_STORAGE_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "factory_records" (
    "id" BIGSERIAL PRIMARY KEY,
    "collection" TEXT NOT NULL,
    "block_num" BIGINT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "payload" JSONB NOT NULL
  )`,
  `COMMENT ON TABLE "factory_records" IS 'Версионированные записи фабрики документов: данные пайщиков, реквизиты, переменные, udata, подписи'`,
  `COMMENT ON COLUMN "factory_records"."collection" IS 'Коллекция записи: individuals, organizations, entrepreneurs, paymentMethods, vars, projects, udatas, signatures'`,
  `COMMENT ON COLUMN "factory_records"."block_num" IS 'Блок цепи на момент записи; текущая версия — последняя по блоку'`,
  `COMMENT ON COLUMN "factory_records"."deleted" IS 'Пометка удаления: ставится на все версии, строки не стираются'`,
  `CREATE INDEX IF NOT EXISTS "factory_records_collection_version_idx" ON "factory_records" ("collection", "block_num" DESC, "id" DESC)`,
  `CREATE INDEX IF NOT EXISTS "factory_records_username_idx" ON "factory_records" ("collection", ("payload"->>'username'))`,
  `CREATE INDEX IF NOT EXISTS "factory_records_coopname_idx" ON "factory_records" ("collection", ("payload"->>'coopname'))`,
  `CREATE INDEX IF NOT EXISTS "factory_records_payload_gin" ON "factory_records" USING GIN ("payload" jsonb_path_ops)`,

  `CREATE TABLE IF NOT EXISTS "factory_documents" (
    "id" BIGSERIAL PRIMARY KEY,
    "hash" TEXT NOT NULL,
    "meta_key" TEXT NOT NULL,
    "registry_id" INTEGER NOT NULL,
    "block_num" BIGINT,
    "full_title" TEXT,
    "html" TEXT NOT NULL,
    "meta" JSONB NOT NULL,
    "binary" BYTEA NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT "factory_documents_hash_meta_key_key" UNIQUE ("hash", "meta_key")
  )`,
  `COMMENT ON TABLE "factory_documents" IS 'Собранные документы фабрики: версия по хэшу и ключу меты, тело PDF в binary'`,
  `CREATE INDEX IF NOT EXISTS "factory_documents_registry_idx" ON "factory_documents" ("registry_id", "id")`,
  `CREATE INDEX IF NOT EXISTS "factory_documents_hash_block_idx" ON "factory_documents" ("hash", "block_num")`,

  `CREATE TABLE IF NOT EXISTS "factory_doc_private_data" (
    "hash" TEXT PRIMARY KEY,
    "registry_id" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  )`,
  `COMMENT ON TABLE "factory_doc_private_data" IS 'Приватные данные документа по хэшу содержимого; в цепь публикуется только хэш'`,
]
