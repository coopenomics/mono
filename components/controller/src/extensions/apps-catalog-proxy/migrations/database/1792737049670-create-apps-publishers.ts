import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Назначения издателей «аккаунт → пакет» (487-27) — таблица расширения
 * «apps-catalog-proxy». Одно назначение на тройку кооператив–пайщик–пакет;
 * стол издателя ищет назначения по кооперативу и пайщику.
 */
const UP: readonly string[] = [
  'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
  'CREATE TABLE IF NOT EXISTS "apps_publishers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "coopname" character varying(12) NOT NULL, "username" character varying(12) NOT NULL, "package_id" character varying(214) NOT NULL, "added_by" character varying(12) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_apps_publishers" PRIMARY KEY ("id"), CONSTRAINT "uq_apps_publishers_assignment" UNIQUE ("coopname", "username", "package_id"))',
  'CREATE INDEX IF NOT EXISTS "idx_apps_publishers_user" ON "apps_publishers" ("coopname", "username")',
];

const DOWN: readonly string[] = ['DROP TABLE IF EXISTS "apps_publishers"'];

export class AppsCatalogProxyCreateAppsPublishers1792737049670 implements SchemaMigration {
  name = 'AppsCatalogProxyCreateAppsPublishers1792737049670';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
