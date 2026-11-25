import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Таблицы приложения «Поздравления» (C28-75): шаблоны председателя,
 * календарь дней рождения и журнал отправок.
 *
 * Календарь — своя выборка расширения: склад данных пайщиков держит дату
 * рождения в jsonb без индекса, и отбор именинников дня по нему читал бы
 * всех пайщиков. Здесь отбор идёт по индексу (месяц, день).
 *
 * Журнал хранит одну строку на пайщика и год: уникальный ключ не даёт
 * поздравить дважды, даже если рассылка запустится повторно.
 */
const UP: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS "greetings_templates" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "title" character varying(200) NOT NULL,
    "period_start" date NOT NULL,
    "period_end" date NOT NULL,
    "subject" character varying(300) NOT NULL,
    "body" text NOT NULL,
    "status" character varying(16) NOT NULL DEFAULT 'draft',
    "created_by" character varying(13) NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT "PK_greetings_templates" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_greetings_templates_period" ON "greetings_templates" ("period_start", "period_end")`,
  `COMMENT ON COLUMN "greetings_templates"."body" IS 'Текст письма в Markdown с переменными в двойных фигурных скобках'`,
  `COMMENT ON COLUMN "greetings_templates"."status" IS 'draft — черновик, active — действует: рассылка берёт шаблон в дни периода'`,
  `CREATE TABLE IF NOT EXISTS "greetings_calendar" (
    "username" character varying(13) NOT NULL,
    "account_type" character varying(16) NOT NULL,
    "birth_year" smallint NOT NULL,
    "birth_month" smallint NOT NULL,
    "birth_day" smallint NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT "PK_greetings_calendar" PRIMARY KEY ("username")
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_greetings_calendar_month_day" ON "greetings_calendar" ("birth_month", "birth_day")`,
  `COMMENT ON COLUMN "greetings_calendar"."account_type" IS 'individual — физическое лицо, entrepreneur — индивидуальный предприниматель'`,
  `CREATE TABLE IF NOT EXISTS "greetings_sends" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "username" character varying(13) NOT NULL,
    "year" smallint NOT NULL,
    "status" character varying(16) NOT NULL,
    "reason" character varying(32),
    "error" text,
    "template_id" uuid,
    "template_title" character varying(200),
    "subject" character varying(300),
    "attempts" integer NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT "PK_greetings_sends" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_greetings_sends_username_year" UNIQUE ("username", "year")
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_greetings_sends_created_at" ON "greetings_sends" ("created_at")`,
  `COMMENT ON COLUMN "greetings_sends"."status" IS 'sent — принято к доставке, skipped — не отправлено по причине reason, failed — ошибка, повтор в тот же день'`,
  `COMMENT ON COLUMN "greetings_sends"."reason" IS 'no_template — нет действующего шаблона, not_active — пайщик не действующий, no_recipient — нет почты или подписки'`,
];

export class GreetingsTables1795546118217 implements SchemaMigration {
  name = 'GreetingsTables1795546118217';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "greetings_sends"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "greetings_calendar"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "greetings_templates"`);
  }
}
