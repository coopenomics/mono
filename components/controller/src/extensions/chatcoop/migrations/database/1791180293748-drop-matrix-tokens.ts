import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Таблица одноразовых токенов Matrix удаляется.
 *
 * Сервис, который выдавал такие токены, никто не вызывал; он убран при переводе
 * чата на Kysely (C28-81). Обращений к таблице в коде нет.
 */
const UP: readonly string[] = [
  "DROP TABLE IF EXISTS \"matrix_tokens\"",
];

const DOWN: readonly string[] = [
  "CREATE TABLE IF NOT EXISTS \"matrix_tokens\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"coop_username\" character varying NOT NULL, \"matrix_user_id\" character varying NOT NULL, \"token\" character varying NOT NULL, \"expires_at\" TIMESTAMP NOT NULL, \"is_used\" boolean NOT NULL DEFAULT false, \"created_at\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"UQ_25b1718a2dcd40432f9cd1aad20\" UNIQUE (\"token\"), CONSTRAINT \"PK_b8f9d9d263168daaa7eada011a3\" PRIMARY KEY (\"id\"))",
];

export class ChatcoopDropMatrixTokens1791180293748 implements SchemaMigration {
  name = 'ChatcoopDropMatrixTokens1791180293748';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
