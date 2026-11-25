import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Рассылки по датам (C28-75, решение владельца 25.11.2026): приложение
 * поздравляет пайщика в день рождения и рассылает всем действующим пайщикам
 * информационные письма в назначенную дату — праздники, объявления.
 *
 * Шаблон получает повод: `birthday` — день рождения, `mailing` — рассылка в
 * дату. Дата рассылки — первый день периода, признак `repeat_yearly`
 * повторяет её каждый год (праздники).
 *
 * Журнал получает повод и дату повода. Прежний уникальный ключ (пайщик, год)
 * держал одно поздравление в год; рассылок в год у пайщика много, поэтому
 * ключей два: у дня рождения — прежний, у рассылки — (шаблон, пайщик, дата).
 */
const UP: readonly string[] = [
  `ALTER TABLE "greetings_templates" ADD COLUMN IF NOT EXISTS "kind" character varying(16) NOT NULL DEFAULT 'birthday'`,
  `ALTER TABLE "greetings_templates" ADD COLUMN IF NOT EXISTS "repeat_yearly" boolean NOT NULL DEFAULT false`,
  `ALTER TABLE "greetings_templates" ADD COLUMN IF NOT EXISTS "sent_on" date`,
  `COMMENT ON COLUMN "greetings_templates"."kind" IS 'birthday — поздравление в день рождения пайщика, mailing — рассылка всем действующим пайщикам в дату period_start'`,
  `COMMENT ON COLUMN "greetings_templates"."repeat_yearly" IS 'Рассылка повторяется каждый год в тот же день (праздник)'`,
  `COMMENT ON COLUMN "greetings_templates"."sent_on" IS 'Дата, в которую рассылка обошла всех пайщиков без ошибок; повторный запуск в этот день пайщиков не перебирает'`,
  `ALTER TABLE "greetings_sends" ADD COLUMN IF NOT EXISTS "kind" character varying(16) NOT NULL DEFAULT 'birthday'`,
  `ALTER TABLE "greetings_sends" ADD COLUMN IF NOT EXISTS "occasion_date" date`,
  `COMMENT ON COLUMN "greetings_sends"."kind" IS 'birthday — поздравление с днём рождения, mailing — рассылка в дату'`,
  `COMMENT ON COLUMN "greetings_sends"."occasion_date" IS 'Дата рассылки; у поздравления пусто — его ключ (пайщик, год)'`,
  `ALTER TABLE "greetings_sends" DROP CONSTRAINT IF EXISTS "UQ_greetings_sends_username_year"`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_greetings_sends_birthday" ON "greetings_sends" ("username", "year") WHERE "kind" = 'birthday'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_greetings_sends_mailing" ON "greetings_sends" ("template_id", "username", "occasion_date") WHERE "kind" = 'mailing'`,
];

export class GreetingsMailings1795585975722 implements SchemaMigration {
  name = 'GreetingsMailings1795585975722';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_greetings_sends_mailing"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_greetings_sends_birthday"`);
    await queryRunner.query(`DELETE FROM "greetings_sends" WHERE "kind" <> 'birthday'`);
    await queryRunner.query(
      `ALTER TABLE "greetings_sends" ADD CONSTRAINT "UQ_greetings_sends_username_year" UNIQUE ("username", "year")`
    );
    await queryRunner.query(`ALTER TABLE "greetings_sends" DROP COLUMN IF EXISTS "occasion_date"`);
    await queryRunner.query(`ALTER TABLE "greetings_sends" DROP COLUMN IF EXISTS "kind"`);
    await queryRunner.query(`ALTER TABLE "greetings_templates" DROP COLUMN IF EXISTS "sent_on"`);
    await queryRunner.query(`ALTER TABLE "greetings_templates" DROP COLUMN IF EXISTS "repeat_yearly"`);
    await queryRunner.query(`ALTER TABLE "greetings_templates" DROP COLUMN IF EXISTS "kind"`);
  }
}
