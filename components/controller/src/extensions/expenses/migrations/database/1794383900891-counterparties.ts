import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Реестр контрагентов шасси расходов и способ оплаты записи плана (задача
 * 99D-35, решение владельца 11.11.2026).
 *
 * Контрагент — организация или ИП, которым кооператив платит по реквизитам.
 * Реквизиты хранятся одним объектом: их состав страновой (пакет юрисдикций),
 * налоговый номер вынесен в колонку для поиска и распознавания повтора.
 * Контрагент кооператива — без участка; контрагент, добавленный участком, —
 * с его именем: пометка, кто завёл, а не ограничение видимости.
 *
 * Запись плана получает способ оплаты: организации — по реквизитам
 * контрагента, пайщику — авансом под отчёт на выбранный способ получения
 * средств. Прежний текст реквизитов (`pay_to`) больше не обязателен: новые
 * записи его не вводят, старые показывают до оплаты.
 */
const UP: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "expense_counterparties" (
    "id" SERIAL NOT NULL,
    "coopname" character varying(13) NOT NULL,
    "braname" character varying(13),
    "kind" character varying(16) NOT NULL,
    "name" character varying(500) NOT NULL,
    "tax_id" character varying(32) NOT NULL,
    "requisites" jsonb NOT NULL,
    "payment_purpose" character varying(210),
    "archived" boolean NOT NULL DEFAULT false,
    "creator" character varying(13) NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT "PK_expense_counterparties" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_expense_counterparties_coop_tax" ON "expense_counterparties" ("coopname", "tax_id")`,
  `COMMENT ON COLUMN "expense_counterparties"."braname" IS 'Участок, который добавил контрагента; NULL — контрагент кооператива. Видят всех контрагентов все участки'`,
  `COMMENT ON COLUMN "expense_counterparties"."kind" IS 'Вид контрагента: LEGAL — юридическое лицо, ENTREPRENEUR — индивидуальный предприниматель'`,
  `COMMENT ON COLUMN "expense_counterparties"."tax_id" IS 'Налоговый номер (в России — ИНН): поиск и распознавание повтора'`,
  `COMMENT ON COLUMN "expense_counterparties"."requisites" IS 'Реквизиты по полям страны кооператива (пакет юрисдикций)'`,
  `COMMENT ON COLUMN "expense_counterparties"."payment_purpose" IS 'Назначение платежа по умолчанию — подставляется в запись плана и служебную записку'`,
  `COMMENT ON COLUMN "expense_counterparties"."archived" IS 'В архиве: не предлагается для новых расходов, прежние записи его сохраняют'`,
  `ALTER TABLE "expense_plans" ADD COLUMN IF NOT EXISTS "recipient_type" character varying(8)`,
  `ALTER TABLE "expense_plans" ADD COLUMN IF NOT EXISTS "counterparty_id" integer`,
  `ALTER TABLE "expense_plans" ADD COLUMN IF NOT EXISTS "recipient" character varying(13)`,
  `ALTER TABLE "expense_plans" ADD COLUMN IF NOT EXISTS "payment_method_id" character varying(64)`,
  `ALTER TABLE "expense_plans" ADD COLUMN IF NOT EXISTS "payment_purpose" character varying(210)`,
  `ALTER TABLE "expense_plans" ALTER COLUMN "pay_to" DROP NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "IDX_expense_plans_counterparty" ON "expense_plans" ("counterparty_id")`,
  `COMMENT ON COLUMN "expense_plans"."recipient_type" IS 'Получатель: ORG — организация по реквизитам контрагента, SELF/MEMBER — пайщик авансом под отчёт; NULL — запись до способов оплаты'`,
  `COMMENT ON COLUMN "expense_plans"."counterparty_id" IS 'Контрагент-получатель оплаты по реквизитам'`,
  `COMMENT ON COLUMN "expense_plans"."recipient" IS 'Пайщик-получатель аванса под отчёт'`,
  `COMMENT ON COLUMN "expense_plans"."payment_method_id" IS 'Способ получения средств пайщика; реквизиты копируются в снимок при подаче записки'`,
  `COMMENT ON COLUMN "expense_plans"."payment_purpose" IS 'Назначение платежа организации'`,
  `COMMENT ON COLUMN "expense_plans"."pay_to" IS 'Реквизиты текстом у записей до способов оплаты; новые записи не заполняют'`,
];

const DOWN: readonly string[] = [
  `DROP INDEX IF EXISTS "IDX_expense_plans_counterparty"`,
  `ALTER TABLE "expense_plans" DROP COLUMN IF EXISTS "payment_purpose"`,
  `ALTER TABLE "expense_plans" DROP COLUMN IF EXISTS "payment_method_id"`,
  `ALTER TABLE "expense_plans" DROP COLUMN IF EXISTS "recipient"`,
  `ALTER TABLE "expense_plans" DROP COLUMN IF EXISTS "counterparty_id"`,
  `ALTER TABLE "expense_plans" DROP COLUMN IF EXISTS "recipient_type"`,
  `DROP TABLE IF EXISTS "expense_counterparties"`,
];

export class ExpensesCounterparties1794383900891 implements SchemaMigration {
  name = 'ExpensesCounterparties1794383900891';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
