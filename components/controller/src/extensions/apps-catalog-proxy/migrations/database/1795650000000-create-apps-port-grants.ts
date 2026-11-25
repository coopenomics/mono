import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Заявки приложений каталога на порты ядра (25.11.2026, 487-17).
 *
 * Приложение каталога работает в своём контейнере и обращается к ядру по сети.
 * Строка — разрешение одному пакету: какие порты ему открыты и какие действия
 * цепи ядро подпишет по его просьбе. Токен приложения хранится хэшем: по
 * нему ядро узнаёт пакет в каждом вызове. Строку заводит установка
 * приложения и стирает его снятие — отозванный токен перестаёт работать сразу.
 */
const UP: readonly string[] = [
  'CREATE TABLE IF NOT EXISTS "apps_port_grants" ("package_id" character varying(214) NOT NULL, "token_hash" character varying(64) NOT NULL, "ports" jsonb NOT NULL DEFAULT \'[]\'::jsonb, "chain_actions" jsonb NOT NULL DEFAULT \'[]\'::jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_apps_port_grants" PRIMARY KEY ("package_id"))',
  'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_apps_port_grants_token_hash" ON "apps_port_grants" ("token_hash")',
];

const DOWN: readonly string[] = ['DROP TABLE IF EXISTS "apps_port_grants"'];

export class AppsCatalogProxyCreatePortGrants1795650000000 implements SchemaMigration {
  name = 'AppsCatalogProxyCreatePortGrants1795650000000';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
