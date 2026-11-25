import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Удаление расширения без стирания записи (решение владельца 24.11.2026).
 *
 * Раньше «Удалить» стирало строку `extensions` вместе с `config`, а в нём
 * кроме настроек председателя лежат отметки онбординга (решения совета о
 * положении ЦПП и их хэши), учёт собраний и служебные даты расширений. После
 * повторной установки совет проходил те же решения заново, а
 * `installDefaultApps` при старте сервера возвращал удалённое расширение из
 * набора по умолчанию с пустыми настройками.
 *
 * Теперь удаление ставит отметку времени: строка с отметкой для стола —
 * неустановленное расширение, повторная установка снимает отметку и
 * продолжает с сохранённого `config`.
 */
const UP: readonly string[] = [
  `ALTER TABLE "extensions" ADD COLUMN IF NOT EXISTS "uninstalled_at" TIMESTAMP`,
  `COMMENT ON COLUMN "extensions"."uninstalled_at" IS 'Когда расширение удалено председателем; NULL — установлено. Запись и настройки сохраняются для повторной установки'`,
];

const DOWN: readonly string[] = [
  // Откат возвращает прежнюю семантику «строка есть — установлено»: удалённые
  // расширения стираются, как стирались до этой миграции
  `DELETE FROM "extensions" WHERE "uninstalled_at" IS NOT NULL`,
  `ALTER TABLE "extensions" DROP COLUMN IF EXISTS "uninstalled_at"`,
];

export class CoreExtensionsSoftUninstall1795501306341 implements SchemaMigration {
  name = 'CoreExtensionsSoftUninstall1795501306341';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
