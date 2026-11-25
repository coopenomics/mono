import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Заявки на выплату до решения совета (решение владельца 04.11.2026).
 *
 * Выплата из кооператива, которую решает совет (возврат паевого взноса,
 * материальная помощь), раньше заводилась платежом сразу при подаче — в
 * статусе «ожидает решения совета». Платёж — поручение кассиру выплатить
 * деньги, и до решения совета его быть не должно: кассир видел такой платёж,
 * а сервер позволял сменить его статус. Теперь при подаче сохраняется заявка
 * на выплату с реквизитами, выбранными пайщиком, а платёж кассиру создаёт
 * решение совета.
 *
 * Колонки повторяют платёж — из заявки платёж собирается один в один.
 * `status` — состояние заявки: `awaiting` ждёт решения совета, `released`
 * выплата разрешена и платёж создан, `declined` совет отказал.
 *
 * Перенос: висящие платежи «ожидает решения совета» становятся заявками и
 * удаляются из платежей — решение совета по ним создаст платёж заново.
 */
export class CorePayoutRequests1793781600000 implements MigrationInterface {
  name = 'CorePayoutRequests1793781600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "payout_requests" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"hash" character varying NOT NULL, ` +
        `"coopname" character varying NOT NULL, ` +
        `"username" character varying NOT NULL, ` +
        `"quantity" numeric NOT NULL, ` +
        `"symbol" character varying NOT NULL, ` +
        `"type" "public"."payments_type_enum" NOT NULL, ` +
        `"provider" character varying, ` +
        `"payment_method_id" character varying, ` +
        `"memo" text, ` +
        `"expired_at" TIMESTAMP, ` +
        `"payment_details" json, ` +
        `"blockchain_data" json, ` +
        `"statement" json, ` +
        `"related_extension" character varying(64), ` +
        `"related_entity_id" character varying(64), ` +
        `"status" character varying(16) NOT NULL DEFAULT 'awaiting', ` +
        `"decided_at" TIMESTAMP, ` +
        `"created_at" TIMESTAMP NOT NULL DEFAULT now(), ` +
        `"updated_at" TIMESTAMP NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_payout_requests" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_payout_requests_hash" ON "payout_requests" ("hash")`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_payout_requests_member" ON "payout_requests" ("coopname", "username")`
    );
    await queryRunner.query(`COMMENT ON TABLE "payout_requests" IS 'Заявки на выплату до решения совета: реквизиты и сумма будущего платежа кассиру'`);
    await queryRunner.query(`COMMENT ON COLUMN "payout_requests"."hash" IS 'Хэш заявки — им же станет хэш платежа'`);
    await queryRunner.query(`COMMENT ON COLUMN "payout_requests"."status" IS 'awaiting — ждёт решения совета, released — платёж создан, declined — совет отказал'`);

    // Висящие платежи «ожидает решения совета» — в заявки; платёж создаст решение совета.
    await queryRunner.query(
      `INSERT INTO "payout_requests" ("hash", "coopname", "username", "quantity", "symbol", "type", "provider", ` +
        `"payment_method_id", "memo", "expired_at", "payment_details", "blockchain_data", "statement", ` +
        `"related_extension", "related_entity_id", "created_at", "updated_at") ` +
        `SELECT LOWER("hash"), "coopname", "username", "quantity", "symbol", "type", "provider", "payment_method_id", ` +
        `"memo", "expired_at", "payment_details", "blockchain_data", "statement", "related_extension", ` +
        `"related_entity_id", "created_at", COALESCE("updated_at", "created_at") ` +
        `FROM "payments" WHERE "status" = 'awaiting_authorization' ` +
        `ON CONFLICT ("hash") DO NOTHING`
    );
    await queryRunner.query(
      `DELETE FROM "payments" WHERE "status" = 'awaiting_authorization' ` +
        `AND LOWER("hash") IN (SELECT "hash" FROM "payout_requests")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Обратно: ждущие решения заявки снова становятся платежами «ожидает решения совета».
    await queryRunner.query(
      `INSERT INTO "payments" ("hash", "coopname", "username", "quantity", "symbol", "type", "direction", "status", ` +
        `"provider", "payment_method_id", "memo", "expired_at", "payment_details", "blockchain_data", "statement", ` +
        `"related_extension", "related_entity_id", "created_at", "updated_at") ` +
        `SELECT "hash", "coopname", "username", "quantity", "symbol", "type", 'outgoing', 'awaiting_authorization', ` +
        `"provider", "payment_method_id", "memo", "expired_at", "payment_details", "blockchain_data", "statement", ` +
        `"related_extension", "related_entity_id", "created_at", "updated_at" ` +
        `FROM "payout_requests" WHERE "status" = 'awaiting'`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "payout_requests"`);
  }
}
