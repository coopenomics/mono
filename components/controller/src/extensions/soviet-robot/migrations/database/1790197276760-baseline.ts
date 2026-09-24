import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Стартовая миграция таблиц расширения «soviet-robot»: 2 таблиц.
 *
 * Идемпотентна: на пустой базе создаёт всё, на базе, которую раньше вёл
 * synchronize, добавляет только недостающее и ничего не удаляет.
 *
 * Сгенерировано командой `pnpm schema:baseline` — SQL выписан TypeORM из сущностей.
 */
const UP: readonly string[] = [
  "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"",
  "CREATE TABLE IF NOT EXISTS \"soviet_robot_decisions\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"coopname\" character varying(13) NOT NULL, \"decision_id\" integer NOT NULL, \"decision_type\" character varying(13) NOT NULL, \"decision_hash\" character varying(64) NOT NULL, \"username\" character varying(13) NOT NULL, \"stage\" character varying(32) NOT NULL DEFAULT 'new', \"votes\" jsonb NOT NULL DEFAULT '[]', \"waiting_for\" jsonb NOT NULL DEFAULT '[]', \"protocol_hash\" character varying(64), \"tx_hashes\" jsonb NOT NULL DEFAULT '[]', \"last_error\" text, \"attempts\" integer NOT NULL DEFAULT '0', \"next_attempt_at\" TIMESTAMP WITH TIME ZONE, \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"PK_22de82c085e7c2325417493f62d\" PRIMARY KEY (\"id\"))",
  "CREATE TABLE IF NOT EXISTS \"soviet_robot_keys\" (\"id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"coopname\" character varying(13) NOT NULL, \"member\" character varying(13) NOT NULL, \"permission_name\" character varying(13) NOT NULL, \"encrypted_wif\" text NOT NULL, \"public_key\" character varying(80) NOT NULL, \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"PK_427c9a9eff0c851d8fecafe7a54\" PRIMARY KEY (\"id\"))",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"id\" uuid NOT NULL DEFAULT uuid_generate_v4()",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying(13) NOT NULL",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"decision_id\" integer NOT NULL",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"decision_type\" character varying(13) NOT NULL",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"decision_hash\" character varying(64) NOT NULL",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"username\" character varying(13) NOT NULL",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"stage\" character varying(32) NOT NULL DEFAULT 'new'",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"votes\" jsonb NOT NULL DEFAULT '[]'",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"waiting_for\" jsonb NOT NULL DEFAULT '[]'",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"protocol_hash\" character varying(64)",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"tx_hashes\" jsonb NOT NULL DEFAULT '[]'",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"last_error\" text",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"attempts\" integer NOT NULL DEFAULT '0'",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"next_attempt_at\" TIMESTAMP WITH TIME ZONE",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
  "ALTER TABLE \"soviet_robot_decisions\" ADD COLUMN IF NOT EXISTS \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
  "ALTER TABLE \"soviet_robot_keys\" ADD COLUMN IF NOT EXISTS \"id\" uuid NOT NULL DEFAULT uuid_generate_v4()",
  "ALTER TABLE \"soviet_robot_keys\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying(13) NOT NULL",
  "ALTER TABLE \"soviet_robot_keys\" ADD COLUMN IF NOT EXISTS \"member\" character varying(13) NOT NULL",
  "ALTER TABLE \"soviet_robot_keys\" ADD COLUMN IF NOT EXISTS \"permission_name\" character varying(13) NOT NULL",
  "ALTER TABLE \"soviet_robot_keys\" ADD COLUMN IF NOT EXISTS \"encrypted_wif\" text NOT NULL",
  "ALTER TABLE \"soviet_robot_keys\" ADD COLUMN IF NOT EXISTS \"public_key\" character varying(80) NOT NULL",
  "ALTER TABLE \"soviet_robot_keys\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
  "ALTER TABLE \"soviet_robot_keys\" ADD COLUMN IF NOT EXISTS \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
  "CREATE INDEX IF NOT EXISTS \"IDX_0509364131a99fc2222d8ed110\" ON \"soviet_robot_decisions\" (\"coopname\", \"stage\") ",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"IDX_c70bfcdd0e52ad226d7262a9f1\" ON \"soviet_robot_decisions\" (\"coopname\", \"decision_id\") ",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"IDX_dec19bbba6122a6e28ee8a93b9\" ON \"soviet_robot_keys\" (\"coopname\", \"member\") ",
];

export class SovietRobotBaseline1790197276760 implements MigrationInterface {
  name = 'SovietRobotBaseline1790197276760';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('SovietRobotBaseline1790197276760 не откатывается: удаление таблиц стартовой миграции стёрло бы данные');
  }
}
