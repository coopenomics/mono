import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Стартовая миграция таблиц расширения «ku»: 3 таблиц.
 *
 * Идемпотентна: на пустой базе создаёт всё, на базе, которую раньше вёл
 * synchronize, добавляет только недостающее и ничего не удаляет.
 *
 * Сгенерировано командой `pnpm schema:baseline` — SQL выписан TypeORM из сущностей.
 */
const UP: readonly string[] = [
  "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"",
  "CREATE TABLE IF NOT EXISTS \"ku_decisions\" (\"_id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"block_num\" integer NOT NULL DEFAULT '0', \"present\" boolean NOT NULL DEFAULT false, \"status\" character varying NOT NULL DEFAULT 'UNDEFINED', \"_created_at\" TIMESTAMP NOT NULL DEFAULT now(), \"_updated_at\" TIMESTAMP NOT NULL DEFAULT now(), \"id\" integer, \"hash\" character varying NOT NULL, \"coopname\" character varying(12) NOT NULL, \"type\" character varying(12) NOT NULL, \"initiator\" character varying(12) NOT NULL, \"chairman\" character varying(12) NOT NULL DEFAULT '', \"proposal\" jsonb, \"protocol\" jsonb, \"petition\" jsonb, \"liability\" jsonb, \"authority\" jsonb, \"authorization\" jsonb, \"open_at\" TIMESTAMP, \"close_at\" TIMESTAMP, \"signed_ballots\" integer NOT NULL DEFAULT '0', \"braname\" character varying(12) NOT NULL DEFAULT '', \"address\" character varying NOT NULL DEFAULT '', \"participants\" jsonb NOT NULL DEFAULT '[]', \"created_at\" TIMESTAMP, \"meet_place\" character varying, \"meet_at\" TIMESTAMP, \"branch_name\" character varying, \"branch_email\" character varying, \"branch_phone\" character varying, \"cancelled\" boolean NOT NULL DEFAULT false, \"meet_reminder_sent\" boolean NOT NULL DEFAULT false, CONSTRAINT \"PK_b9047bc0e5cce40f7bc2be57809\" PRIMARY KEY (\"_id\"))",
  "CREATE TABLE IF NOT EXISTS \"ku_decision_questions\" (\"_id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"block_num\" integer NOT NULL DEFAULT '0', \"present\" boolean NOT NULL DEFAULT false, \"status\" character varying NOT NULL DEFAULT 'UNDEFINED', \"_created_at\" TIMESTAMP NOT NULL DEFAULT now(), \"_updated_at\" TIMESTAMP NOT NULL DEFAULT now(), \"id\" integer, \"decision_id\" integer NOT NULL, \"number\" integer NOT NULL, \"coopname\" character varying(12) NOT NULL, \"title\" text NOT NULL, \"decision\" text NOT NULL, \"context\" text NOT NULL DEFAULT '', \"counter_votes_for\" integer NOT NULL DEFAULT '0', \"counter_votes_against\" integer NOT NULL DEFAULT '0', \"counter_votes_abstained\" integer NOT NULL DEFAULT '0', \"voters_for\" jsonb NOT NULL DEFAULT '[]', \"voters_against\" jsonb NOT NULL DEFAULT '[]', \"voters_abstained\" jsonb NOT NULL DEFAULT '[]', CONSTRAINT \"PK_500db76606662cc71ca3c022833\" PRIMARY KEY (\"_id\"))",
  "CREATE TABLE IF NOT EXISTS \"ku_trust_requests\" (\"_id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"block_num\" integer NOT NULL DEFAULT '0', \"present\" boolean NOT NULL DEFAULT false, \"status\" character varying NOT NULL DEFAULT 'UNDEFINED', \"_created_at\" TIMESTAMP NOT NULL DEFAULT now(), \"_updated_at\" TIMESTAMP NOT NULL DEFAULT now(), \"id\" integer, \"hash\" character varying NOT NULL, \"coopname\" character varying(12) NOT NULL, \"braname\" character varying(12) NOT NULL, \"username\" character varying(12) NOT NULL, \"application\" jsonb, \"authority\" jsonb, CONSTRAINT \"PK_7b7674552f006900b5d25448022\" PRIMARY KEY (\"_id\"))",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"_id\" uuid NOT NULL DEFAULT uuid_generate_v4()",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"block_num\" integer NOT NULL DEFAULT '0'",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"present\" boolean NOT NULL DEFAULT false",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"status\" character varying NOT NULL DEFAULT 'UNDEFINED'",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"_created_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"_updated_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"id\" integer",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"hash\" character varying NOT NULL",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying(12) NOT NULL",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"type\" character varying(12) NOT NULL",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"initiator\" character varying(12) NOT NULL",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"chairman\" character varying(12) NOT NULL DEFAULT ''",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"proposal\" jsonb",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"protocol\" jsonb",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"petition\" jsonb",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"liability\" jsonb",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"authority\" jsonb",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"authorization\" jsonb",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"open_at\" TIMESTAMP",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"close_at\" TIMESTAMP",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"signed_ballots\" integer NOT NULL DEFAULT '0'",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"braname\" character varying(12) NOT NULL DEFAULT ''",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"address\" character varying NOT NULL DEFAULT ''",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"participants\" jsonb NOT NULL DEFAULT '[]'",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"meet_place\" character varying",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"meet_at\" TIMESTAMP",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"branch_name\" character varying",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"branch_email\" character varying",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"branch_phone\" character varying",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"cancelled\" boolean NOT NULL DEFAULT false",
  "ALTER TABLE \"ku_decisions\" ADD COLUMN IF NOT EXISTS \"meet_reminder_sent\" boolean NOT NULL DEFAULT false",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"_id\" uuid NOT NULL DEFAULT uuid_generate_v4()",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"block_num\" integer NOT NULL DEFAULT '0'",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"present\" boolean NOT NULL DEFAULT false",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"status\" character varying NOT NULL DEFAULT 'UNDEFINED'",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"_created_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"_updated_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"id\" integer",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"decision_id\" integer NOT NULL",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"number\" integer NOT NULL",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying(12) NOT NULL",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"title\" text NOT NULL",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"decision\" text NOT NULL",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"context\" text NOT NULL DEFAULT ''",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"counter_votes_for\" integer NOT NULL DEFAULT '0'",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"counter_votes_against\" integer NOT NULL DEFAULT '0'",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"counter_votes_abstained\" integer NOT NULL DEFAULT '0'",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"voters_for\" jsonb NOT NULL DEFAULT '[]'",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"voters_against\" jsonb NOT NULL DEFAULT '[]'",
  "ALTER TABLE \"ku_decision_questions\" ADD COLUMN IF NOT EXISTS \"voters_abstained\" jsonb NOT NULL DEFAULT '[]'",
  "ALTER TABLE \"ku_trust_requests\" ADD COLUMN IF NOT EXISTS \"_id\" uuid NOT NULL DEFAULT uuid_generate_v4()",
  "ALTER TABLE \"ku_trust_requests\" ADD COLUMN IF NOT EXISTS \"block_num\" integer NOT NULL DEFAULT '0'",
  "ALTER TABLE \"ku_trust_requests\" ADD COLUMN IF NOT EXISTS \"present\" boolean NOT NULL DEFAULT false",
  "ALTER TABLE \"ku_trust_requests\" ADD COLUMN IF NOT EXISTS \"status\" character varying NOT NULL DEFAULT 'UNDEFINED'",
  "ALTER TABLE \"ku_trust_requests\" ADD COLUMN IF NOT EXISTS \"_created_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"ku_trust_requests\" ADD COLUMN IF NOT EXISTS \"_updated_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"ku_trust_requests\" ADD COLUMN IF NOT EXISTS \"id\" integer",
  "ALTER TABLE \"ku_trust_requests\" ADD COLUMN IF NOT EXISTS \"hash\" character varying NOT NULL",
  "ALTER TABLE \"ku_trust_requests\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying(12) NOT NULL",
  "ALTER TABLE \"ku_trust_requests\" ADD COLUMN IF NOT EXISTS \"braname\" character varying(12) NOT NULL",
  "ALTER TABLE \"ku_trust_requests\" ADD COLUMN IF NOT EXISTS \"username\" character varying(12) NOT NULL",
  "ALTER TABLE \"ku_trust_requests\" ADD COLUMN IF NOT EXISTS \"application\" jsonb",
  "ALTER TABLE \"ku_trust_requests\" ADD COLUMN IF NOT EXISTS \"authority\" jsonb",
  "CREATE INDEX IF NOT EXISTS \"idx_ku_decisions_created_at\" ON \"ku_decisions\" (\"_created_at\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_ku_decisions_initiator\" ON \"ku_decisions\" (\"initiator\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_ku_decisions_braname\" ON \"ku_decisions\" (\"braname\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_ku_decisions_type\" ON \"ku_decisions\" (\"type\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_ku_decisions_coopname\" ON \"ku_decisions\" (\"coopname\") ",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"idx_ku_decisions_hash\" ON \"ku_decisions\" (\"hash\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_ku_decisions_blockchain_id\" ON \"ku_decisions\" (\"id\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_ku_decision_questions_coopname\" ON \"ku_decision_questions\" (\"coopname\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_ku_decision_questions_decision_id\" ON \"ku_decision_questions\" (\"decision_id\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_ku_decision_questions_blockchain_id\" ON \"ku_decision_questions\" (\"id\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_ku_trust_requests_username\" ON \"ku_trust_requests\" (\"username\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_ku_trust_requests_braname\" ON \"ku_trust_requests\" (\"braname\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_ku_trust_requests_coopname\" ON \"ku_trust_requests\" (\"coopname\") ",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"idx_ku_trust_requests_hash\" ON \"ku_trust_requests\" (\"hash\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_ku_trust_requests_blockchain_id\" ON \"ku_trust_requests\" (\"id\") ",
];

export class KuBaseline1790197276757 implements MigrationInterface {
  name = 'KuBaseline1790197276757';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('KuBaseline1790197276757 не откатывается: удаление таблиц стартовой миграции стёрло бы данные');
  }
}
