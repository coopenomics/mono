import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Согласия председателя на права ядра приложений каталога (487-37).
 *
 * Приложения, установленные до правила, считаются согласованными: их права
 * уже выданы заявкой `apps_port_grants`. Без переноса первое же обновление
 * такого приложения встало бы в ожидание согласия на права, которыми оно
 * давно пользуется.
 */
const UP: readonly string[] = [
  'CREATE TABLE IF NOT EXISTS "apps_rights_consents" ("package_id" character varying(214) NOT NULL, "ports" jsonb NOT NULL DEFAULT \'[]\'::jsonb, "chain_actions" jsonb NOT NULL DEFAULT \'[]\'::jsonb, "auto_accept" boolean NOT NULL DEFAULT false, "consented_by" character varying(64), "consented_at" TIMESTAMP WITH TIME ZONE, "pending_ports" jsonb NOT NULL DEFAULT \'[]\'::jsonb, "pending_chain_actions" jsonb NOT NULL DEFAULT \'[]\'::jsonb, "pending_version" character varying(64), "pending_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_apps_rights_consents" PRIMARY KEY ("package_id"))',
  'INSERT INTO "apps_rights_consents" ("package_id", "ports", "chain_actions", "consented_by", "consented_at") SELECT "package_id", "ports", "chain_actions", \'migration\', now() FROM "apps_port_grants" ON CONFLICT ("package_id") DO NOTHING',
];

const DOWN: readonly string[] = ['DROP TABLE IF EXISTS "apps_rights_consents"'];

export class AppsCatalogProxyCreateRightsConsents1795780000000 implements SchemaMigration {
  name = 'AppsCatalogProxyCreateRightsConsents1795780000000';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
