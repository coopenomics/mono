import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Курсоры синхронизации сообщений и расшифровок звонков с GitHub удаляются.
 *
 * Таблицы заведены в марте 2026 вместе с заготовкой такой синхронизации; читать
 * и писать их так никто и не начал (C28-81).
 */
const UP: readonly string[] = [
  "DROP TABLE IF EXISTS \"capital_github_comm_message_cursor\"",
  "DROP TABLE IF EXISTS \"capital_github_comm_transcription_cursor\"",
];

const DOWN: readonly string[] = [
  "CREATE TABLE IF NOT EXISTS \"capital_github_comm_message_cursor\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"coopname\" character varying(255) NOT NULL, \"matrix_room_id\" character varying(255) NOT NULL, \"last_origin_server_ts\" bigint NOT NULL, \"updated_at\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"uq_capital_github_comm_msg_cursor\" UNIQUE (\"coopname\", \"matrix_room_id\"), CONSTRAINT \"PK_5600e67fb17e32b7171e6167dea\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE IF NOT EXISTS \"capital_github_comm_transcription_cursor\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"coopname\" character varying(255) NOT NULL, \"project_hash\" character varying(64) NOT NULL, \"last_ended_at_exclusive\" TIMESTAMP WITH TIME ZONE NOT NULL, \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"uq_capital_github_comm_tr_cursor\" UNIQUE (\"coopname\", \"project_hash\"), CONSTRAINT \"PK_0d03e8e6cebbabf8aaef87bffb8\" PRIMARY KEY (\"id\"))",
];

export class CapitalDropGithubCommCursors1791180505721 implements SchemaMigration {
  name = 'CapitalDropGithubCommCursors1791180505721';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
