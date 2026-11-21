import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Логотип кооператива — отдельное поле в настройках кооператива (`settings`).
 *
 * Раньше кружок в шапке профиля был только у человека (`users.avatar_key`), а
 * у кооператива не было своего изображения вовсе: шапка профиля показывала
 * инициалы. Логотип хранится в настройках узла рядом с остальными данными
 * кооператива — так он один на все столы, а не копия в каждом расширении.
 */
const UP: readonly string[] = [
  `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "logo_key" text`,
  `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "logo_mime" character varying(40)`,
  `COMMENT ON COLUMN "settings"."logo_key" IS 'Ключ логотипа кооператива в хранилище изображений'`,
  `COMMENT ON COLUMN "settings"."logo_mime" IS 'Тип файла логотипа кооператива'`,
];

const DOWN: readonly string[] = [
  `ALTER TABLE "settings" DROP COLUMN IF EXISTS "logo_mime"`,
  `ALTER TABLE "settings" DROP COLUMN IF EXISTS "logo_key"`,
];

export class CoreSettingsCoopLogo1795200000000 implements SchemaMigration {
  name = 'CoreSettingsCoopLogo1795200000000';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
