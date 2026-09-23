import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Стартовая миграция таблиц расширения «cardcoop»: 7 таблиц.
 *
 * Идемпотентна: на пустой базе создаёт всё, на базе, которую раньше вёл
 * synchronize, добавляет только недостающее и ничего не удаляет.
 *
 * Сгенерировано командой `pnpm schema:baseline` — SQL выписан TypeORM из сущностей.
 */
const UP: readonly string[] = [
  "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"",
  "CREATE TABLE IF NOT EXISTS \"cardcoop_attestations\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"username\" character varying(64) NOT NULL, \"card_id\" character varying(64) NOT NULL, \"card_number\" character varying(32), \"attestation_id\" character varying(64), \"state\" character varying(16) NOT NULL DEFAULT 'pending', \"member_since\" character varying(10) NOT NULL, \"last_error\" text, \"revoked_at\" TIMESTAMP WITH TIME ZONE, \"created_at\" TIMESTAMP NOT NULL DEFAULT now(), \"updated_at\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"PK_977f5372f89cff4bf1af24cd78f\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE IF NOT EXISTS \"cardcoop_pending_exits\" (\"exit_hash\" character varying(64) NOT NULL, \"username\" character varying(64) NOT NULL, \"coopname\" character varying(64) NOT NULL, \"created_at\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"PK_edff5ce17ae8d1d1bd4a7e8fb1c\" PRIMARY KEY (\"exit_hash\"))",
  "CREATE TABLE IF NOT EXISTS \"cardcoop_pending_links\" (\"username\" character varying(64) NOT NULL, \"card_id\" character varying(64) NOT NULL, \"card_number\" character varying(32), \"created_at\" TIMESTAMP NOT NULL DEFAULT now(), \"updated_at\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"PK_bb837a49417f68a73e7aba53e95\" PRIMARY KEY (\"username\"))",
  "CREATE TABLE IF NOT EXISTS \"cardcoop_used_grants\" (\"grant_jti\" character varying(64) NOT NULL, \"card_id\" character varying(64) NOT NULL, \"username\" character varying(64) NOT NULL, \"to_coopname\" character varying(64) NOT NULL, \"created_at\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"PK_31fba626b208648502c9937db1b\" PRIMARY KEY (\"grant_jti\"))",
  "CREATE TABLE IF NOT EXISTS \"cardcoop_connect_state\" (\"id\" character varying(8) NOT NULL, \"delivered_hash\" character varying(64), \"last_error\" text, \"rp_client_id\" text, \"rp_client_secret\" text, \"rp_issuer\" text, \"updated_at\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"PK_c35d62512486b54f701637115fa\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE IF NOT EXISTS \"cardcoop_operator_announcements\" (\"coopname\" character varying(64) NOT NULL, \"display_name\" text NOT NULL, \"delivered\" boolean NOT NULL DEFAULT false, \"last_error\" text, \"created_at\" TIMESTAMP NOT NULL DEFAULT now(), \"updated_at\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"PK_c3529c9a39796c86a8fe2c81919\" PRIMARY KEY (\"coopname\"))",
  "CREATE TABLE IF NOT EXISTS \"cardcoop_entry_sessions\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"card_id\" character varying(64) NOT NULL, \"card_number\" character varying(32), \"outcome\" character varying(16) NOT NULL, \"username\" character varying(64), \"memberships\" jsonb NOT NULL DEFAULT '[]', \"disclosure_id\" character varying(64), \"status\" character varying(24) NOT NULL DEFAULT 'started', \"profile_type\" character varying(24), \"profile\" jsonb, \"profile_taken_at\" TIMESTAMP, \"created_at\" TIMESTAMP NOT NULL DEFAULT now(), \"updated_at\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"PK_28c6031b4355c2992904ee0615c\" PRIMARY KEY (\"id\"))",
  "ALTER TABLE \"cardcoop_attestations\" ADD COLUMN IF NOT EXISTS \"id\" uuid NOT NULL DEFAULT uuid_generate_v4()",
  "ALTER TABLE \"cardcoop_attestations\" ADD COLUMN IF NOT EXISTS \"username\" character varying(64) NOT NULL",
  "ALTER TABLE \"cardcoop_attestations\" ADD COLUMN IF NOT EXISTS \"card_id\" character varying(64) NOT NULL",
  "ALTER TABLE \"cardcoop_attestations\" ADD COLUMN IF NOT EXISTS \"card_number\" character varying(32)",
  "ALTER TABLE \"cardcoop_attestations\" ADD COLUMN IF NOT EXISTS \"attestation_id\" character varying(64)",
  "ALTER TABLE \"cardcoop_attestations\" ADD COLUMN IF NOT EXISTS \"state\" character varying(16) NOT NULL DEFAULT 'pending'",
  "ALTER TABLE \"cardcoop_attestations\" ADD COLUMN IF NOT EXISTS \"member_since\" character varying(10) NOT NULL",
  "ALTER TABLE \"cardcoop_attestations\" ADD COLUMN IF NOT EXISTS \"last_error\" text",
  "ALTER TABLE \"cardcoop_attestations\" ADD COLUMN IF NOT EXISTS \"revoked_at\" TIMESTAMP WITH TIME ZONE",
  "ALTER TABLE \"cardcoop_attestations\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"cardcoop_attestations\" ADD COLUMN IF NOT EXISTS \"updated_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"cardcoop_pending_exits\" ADD COLUMN IF NOT EXISTS \"exit_hash\" character varying(64) NOT NULL",
  "ALTER TABLE \"cardcoop_pending_exits\" ADD COLUMN IF NOT EXISTS \"username\" character varying(64) NOT NULL",
  "ALTER TABLE \"cardcoop_pending_exits\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying(64) NOT NULL",
  "ALTER TABLE \"cardcoop_pending_exits\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"cardcoop_pending_links\" ADD COLUMN IF NOT EXISTS \"username\" character varying(64) NOT NULL",
  "ALTER TABLE \"cardcoop_pending_links\" ADD COLUMN IF NOT EXISTS \"card_id\" character varying(64) NOT NULL",
  "ALTER TABLE \"cardcoop_pending_links\" ADD COLUMN IF NOT EXISTS \"card_number\" character varying(32)",
  "ALTER TABLE \"cardcoop_pending_links\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"cardcoop_pending_links\" ADD COLUMN IF NOT EXISTS \"updated_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"cardcoop_used_grants\" ADD COLUMN IF NOT EXISTS \"grant_jti\" character varying(64) NOT NULL",
  "ALTER TABLE \"cardcoop_used_grants\" ADD COLUMN IF NOT EXISTS \"card_id\" character varying(64) NOT NULL",
  "ALTER TABLE \"cardcoop_used_grants\" ADD COLUMN IF NOT EXISTS \"username\" character varying(64) NOT NULL",
  "ALTER TABLE \"cardcoop_used_grants\" ADD COLUMN IF NOT EXISTS \"to_coopname\" character varying(64) NOT NULL",
  "ALTER TABLE \"cardcoop_used_grants\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"cardcoop_connect_state\" ADD COLUMN IF NOT EXISTS \"id\" character varying(8) NOT NULL",
  "ALTER TABLE \"cardcoop_connect_state\" ADD COLUMN IF NOT EXISTS \"delivered_hash\" character varying(64)",
  "ALTER TABLE \"cardcoop_connect_state\" ADD COLUMN IF NOT EXISTS \"last_error\" text",
  "ALTER TABLE \"cardcoop_connect_state\" ADD COLUMN IF NOT EXISTS \"rp_client_id\" text",
  "ALTER TABLE \"cardcoop_connect_state\" ADD COLUMN IF NOT EXISTS \"rp_client_secret\" text",
  "ALTER TABLE \"cardcoop_connect_state\" ADD COLUMN IF NOT EXISTS \"rp_issuer\" text",
  "ALTER TABLE \"cardcoop_connect_state\" ADD COLUMN IF NOT EXISTS \"updated_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"cardcoop_operator_announcements\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying(64) NOT NULL",
  "ALTER TABLE \"cardcoop_operator_announcements\" ADD COLUMN IF NOT EXISTS \"display_name\" text NOT NULL",
  "ALTER TABLE \"cardcoop_operator_announcements\" ADD COLUMN IF NOT EXISTS \"delivered\" boolean NOT NULL DEFAULT false",
  "ALTER TABLE \"cardcoop_operator_announcements\" ADD COLUMN IF NOT EXISTS \"last_error\" text",
  "ALTER TABLE \"cardcoop_operator_announcements\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"cardcoop_operator_announcements\" ADD COLUMN IF NOT EXISTS \"updated_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"cardcoop_entry_sessions\" ADD COLUMN IF NOT EXISTS \"id\" uuid NOT NULL DEFAULT uuid_generate_v4()",
  "ALTER TABLE \"cardcoop_entry_sessions\" ADD COLUMN IF NOT EXISTS \"card_id\" character varying(64) NOT NULL",
  "ALTER TABLE \"cardcoop_entry_sessions\" ADD COLUMN IF NOT EXISTS \"card_number\" character varying(32)",
  "ALTER TABLE \"cardcoop_entry_sessions\" ADD COLUMN IF NOT EXISTS \"outcome\" character varying(16) NOT NULL",
  "ALTER TABLE \"cardcoop_entry_sessions\" ADD COLUMN IF NOT EXISTS \"username\" character varying(64)",
  "ALTER TABLE \"cardcoop_entry_sessions\" ADD COLUMN IF NOT EXISTS \"memberships\" jsonb NOT NULL DEFAULT '[]'",
  "ALTER TABLE \"cardcoop_entry_sessions\" ADD COLUMN IF NOT EXISTS \"disclosure_id\" character varying(64)",
  "ALTER TABLE \"cardcoop_entry_sessions\" ADD COLUMN IF NOT EXISTS \"status\" character varying(24) NOT NULL DEFAULT 'started'",
  "ALTER TABLE \"cardcoop_entry_sessions\" ADD COLUMN IF NOT EXISTS \"profile_type\" character varying(24)",
  "ALTER TABLE \"cardcoop_entry_sessions\" ADD COLUMN IF NOT EXISTS \"profile\" jsonb",
  "ALTER TABLE \"cardcoop_entry_sessions\" ADD COLUMN IF NOT EXISTS \"profile_taken_at\" TIMESTAMP",
  "ALTER TABLE \"cardcoop_entry_sessions\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"cardcoop_entry_sessions\" ADD COLUMN IF NOT EXISTS \"updated_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "CREATE INDEX IF NOT EXISTS \"IDX_cb6f08d21f880bfb11237fbe4a\" ON \"cardcoop_attestations\" (\"username\") ",
  "CREATE INDEX IF NOT EXISTS \"IDX_13164343112224ec7cdbc4279e\" ON \"cardcoop_attestations\" (\"username\", \"state\") ",
];

export class CardcoopBaseline1790197276753 implements MigrationInterface {
  name = 'CardcoopBaseline1790197276753';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('CardcoopBaseline1790197276753 не откатывается: удаление таблиц стартовой миграции стёрло бы данные');
  }
}
