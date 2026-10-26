import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Состояние приложений каталога на узле (26.10.2026): включено ли приложение
 * и его настройки. Подписка живёт у провайдера, фронт — в кэше оркестратора,
 * а переключатель «включить/выключить» и настройки — здесь, как у встроенных
 * расширений в таблице `extensions`. Строка появляется при подписке.
 */
const UP: readonly string[] = [
  'CREATE TABLE IF NOT EXISTS "apps_catalog_apps" ("package_id" character varying(214) NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "config" jsonb NOT NULL DEFAULT \'{}\'::jsonb, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_apps_catalog_apps" PRIMARY KEY ("package_id"))',
];

const DOWN: readonly string[] = ['DROP TABLE IF EXISTS "apps_catalog_apps"'];

export class AppsCatalogProxyCreateCatalogApps1793100000000 implements SchemaMigration {
  name = 'AppsCatalogProxyCreateCatalogApps1793100000000';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
