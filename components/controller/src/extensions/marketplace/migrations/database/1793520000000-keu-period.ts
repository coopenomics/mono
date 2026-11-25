import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Коэффициент экономического участия (задача 99D-22, КЭУ-4; документ модели —
 * требование компонента 68).
 *
 * Три правки учёта узла:
 *  - у строки учёта к списанию появляются стоимость заказа (`base_amount`,
 *    факт выдачи по операции o.mkt.consum) и возвращённая пайщику часть
 *    (`returned_amount`, операция o.mkt.retdue);
 *  - зеркало итогов месяца участка `marketplace_branch_period` — история
 *    прогонов для экранов: в цепи у участка лежат только две строки;
 *  - зеркало заявлений на материальную помощь `marketplace_branch_aid` —
 *    участок заявления нужен для суммы выплаченной помощи по участку, а строка
 *    цепи стирается при подтверждении выплаты.
 */
const UP: readonly string[] = [
  `ALTER TABLE "marketplace_secure_due" ADD COLUMN IF NOT EXISTS "base_amount" numeric(24,4) NOT NULL DEFAULT '0'`,
  `ALTER TABLE "marketplace_secure_due" ADD COLUMN IF NOT EXISTS "returned_amount" numeric(24,4) NOT NULL DEFAULT '0'`,
  `CREATE TABLE IF NOT EXISTS "marketplace_branch_period" (
    "coopname" character varying(13) NOT NULL,
    "braname" character varying(13) NOT NULL,
    "period" integer NOT NULL,
    "turnover" numeric(24,4) NOT NULL DEFAULT '0',
    "secured" numeric(24,4) NOT NULL DEFAULT '0',
    "planned" numeric(24,4) NOT NULL DEFAULT '0',
    "memos" numeric(24,4) NOT NULL DEFAULT '0',
    "aid_paid" numeric(24,4) NOT NULL DEFAULT '0',
    "aid_reserve" numeric(24,4) NOT NULL DEFAULT '0',
    "aid_unpaid" numeric(24,4) NOT NULL DEFAULT '0',
    "expenses" numeric(24,4) NOT NULL DEFAULT '0',
    "membership" numeric(24,4) NOT NULL DEFAULT '0',
    "funds_amount" numeric(24,4) NOT NULL DEFAULT '0',
    "branch_amount" numeric(24,4) NOT NULL DEFAULT '0',
    "initiator_amount" numeric(24,4) NOT NULL DEFAULT '0',
    "return_amount" numeric(24,4) NOT NULL DEFAULT '0',
    "deficit" numeric(24,4) NOT NULL DEFAULT '0',
    "rate_branch" bigint NOT NULL DEFAULT 0,
    "rate_funds" bigint NOT NULL DEFAULT 0,
    "rate_initiator" bigint NOT NULL DEFAULT 0,
    "initiator" character varying(13) NOT NULL DEFAULT '',
    "rows_total" integer NOT NULL DEFAULT 0,
    "rows_charged" integer NOT NULL DEFAULT 0,
    "closed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "deleted_at" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT "PK_marketplace_branch_period" PRIMARY KEY ("coopname", "braname", "period")
  )`,
  `CREATE TABLE IF NOT EXISTS "marketplace_branch_aid" (
    "aid_hash" character varying(64) NOT NULL,
    "coopname" character varying(13) NOT NULL,
    "braname" character varying(13) NOT NULL,
    "username" character varying(13) NOT NULL,
    "amount" numeric(24,4) NOT NULL DEFAULT '0',
    "status" character varying(16) NOT NULL,
    "paid_at" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT "PK_marketplace_branch_aid" PRIMARY KEY ("aid_hash")
  )`,
  'CREATE INDEX IF NOT EXISTS "IDX_marketplace_branch_aid_branch" ON "marketplace_branch_aid" ("coopname", "braname", "status", "paid_at")',
  'CREATE INDEX IF NOT EXISTS "IDX_marketplace_branch_aid_user" ON "marketplace_branch_aid" ("coopname", "username", "created_at")',
];

export class MarketplaceKeuPeriod1793520000000 implements MigrationInterface {
  name = 'MarketplaceKeuPeriod1793520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "marketplace_branch_aid"');
    await queryRunner.query('DROP TABLE IF EXISTS "marketplace_branch_period"');
    await queryRunner.query('ALTER TABLE "marketplace_secure_due" DROP COLUMN IF EXISTS "returned_amount"');
    await queryRunner.query('ALTER TABLE "marketplace_secure_due" DROP COLUMN IF EXISTS "base_amount"');
  }
}
