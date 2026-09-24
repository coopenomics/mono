import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Стартовая миграция таблиц расширения «expenses»: 4 таблиц.
 *
 * Идемпотентна: на пустой базе создаёт всё, на базе, которую раньше вёл
 * synchronize, добавляет только недостающее и ничего не удаляет.
 *
 * Сгенерировано командой `pnpm schema:baseline` — SQL выписан TypeORM из сущностей.
 */
const UP: readonly string[] = [
  "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"",
  "DO $$ BEGIN CREATE TYPE \"public\".\"expense_files_kind_enum\" AS ENUM('PAYMENT_PROOF', 'REPORT_FILE', 'RETURN_PROOF', 'CLOSING_DOC'); EXCEPTION WHEN duplicate_object THEN NULL; END $$",
  "CREATE TABLE IF NOT EXISTS \"expense_files\" (\"id\" SERIAL NOT NULL, \"coopname\" character varying NOT NULL, \"proposal_hash\" character varying NOT NULL, \"item_hash\" character varying, \"kind\" \"public\".\"expense_files_kind_enum\" NOT NULL, \"checksum_sha256\" character varying(64) NOT NULL, \"mime_type\" character varying(120) NOT NULL, \"size_bytes\" integer NOT NULL, \"storage_key\" character varying(512) NOT NULL, \"original_filename\" character varying(255), \"uploaded_by_username\" character varying NOT NULL, \"uploaded_at\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"PK_862d200e8a73733d7a945e715a6\" PRIMARY KEY (\"id\")); COMMENT ON COLUMN \"expense_files\".\"original_filename\" IS 'Оригинальное имя загруженного файла — для отображения и поиска'",
  "CREATE TABLE IF NOT EXISTS \"expense_plans\" (\"id\" SERIAL NOT NULL, \"coopname\" character varying(13) NOT NULL, \"braname\" character varying(13), \"title\" character varying(500) NOT NULL, \"amount\" numeric(20,4) NOT NULL, \"due_date\" TIMESTAMP WITH TIME ZONE, \"recurrence\" character varying(16) NOT NULL DEFAULT 'NONE', \"next_spawned\" boolean NOT NULL DEFAULT false, \"proposal_hash\" character varying(64), \"paid_at\" TIMESTAMP WITH TIME ZONE, \"pay_to\" character varying(1000) NOT NULL, \"creator\" character varying(13) NOT NULL, \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT \"PK_50fef58eeadda46664acd949d48\" PRIMARY KEY (\"id\")); COMMENT ON COLUMN \"expense_plans\".\"braname\" IS 'Кооперативный участок; NULL — расход уровня кооператива'; COMMENT ON COLUMN \"expense_plans\".\"title\" IS 'Назначение расхода'; COMMENT ON COLUMN \"expense_plans\".\"amount\" IS 'Сумма расхода в валюте кооператива'; COMMENT ON COLUMN \"expense_plans\".\"due_date\" IS 'Срок оплаты. Обязателен для новых записей; NULL остался у записей до отмены приоритетов'; COMMENT ON COLUMN \"expense_plans\".\"recurrence\" IS 'Периодичность серии: NONE — разовый; MONTHLY/QUARTERLY/YEARLY — повторяющийся'; COMMENT ON COLUMN \"expense_plans\".\"next_spawned\" IS 'По этой записи уже добавлен следующий экземпляр серии (защита от повторного порождения)'; COMMENT ON COLUMN \"expense_plans\".\"proposal_hash\" IS 'Расход, которым оплачивается запись (служебная записка шасси расходов); NULL — оплата не запускалась'; COMMENT ON COLUMN \"expense_plans\".\"paid_at\" IS 'Когда расход фактически оплачен; оплаченные записи не удерживают резерв'; COMMENT ON COLUMN \"expense_plans\".\"pay_to\" IS 'Реквизиты получателя платежа (строкой — передаётся в платёжку кассиру)'; COMMENT ON COLUMN \"expense_plans\".\"creator\" IS 'Кто добавил запись'",
  "CREATE TABLE IF NOT EXISTS \"expense_proposals\" (\"_id\" uuid NOT NULL DEFAULT uuid_generate_v4(), \"block_num\" integer NOT NULL DEFAULT '0', \"present\" boolean NOT NULL DEFAULT false, \"status\" character varying NOT NULL DEFAULT 'UNDEFINED', \"_created_at\" TIMESTAMP NOT NULL DEFAULT now(), \"_updated_at\" TIMESTAMP NOT NULL DEFAULT now(), \"id\" integer, \"proposal_hash\" character varying NOT NULL, \"coopname\" character varying NOT NULL, \"username\" character varying NOT NULL, \"source_wallet\" character varying NOT NULL, \"blockchain_status\" integer, \"items\" jsonb, \"total_planned\" character varying NOT NULL, \"total_actual\" character varying NOT NULL, \"callback\" jsonb, \"statement_doc\" jsonb, \"decision_doc\" jsonb, \"created_at\" TIMESTAMP, \"updated_at\" TIMESTAMP, CONSTRAINT \"UQ_4036495a1023afd7a245e246552\" UNIQUE (\"id\"), CONSTRAINT \"PK_298536ff4c942c7ed4913403ef9\" PRIMARY KEY (\"_id\"))",
  "CREATE TABLE IF NOT EXISTS \"expense_requisite_snapshots\" (\"id\" SERIAL NOT NULL, \"coopname\" character varying NOT NULL, \"proposal_hash\" character varying NOT NULL, \"item_hash\" character varying NOT NULL, \"recipient\" character varying NOT NULL, \"method_id\" character varying, \"method_type\" character varying, \"data\" jsonb, \"requisites\" text NOT NULL, \"payment_purpose\" text, \"created_at\" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT \"PK_6350f22d9e7f120ca77fbc5bdfa\" PRIMARY KEY (\"id\")); COMMENT ON COLUMN \"expense_requisite_snapshots\".\"recipient\" IS 'Получатель платежа (username пайщика или имя организации)'; COMMENT ON COLUMN \"expense_requisite_snapshots\".\"method_id\" IS 'Идентификатор платёжного метода получателя (для пайщиков)'; COMMENT ON COLUMN \"expense_requisite_snapshots\".\"method_type\" IS 'Тип метода (sbp / bank_transfer)'; COMMENT ON COLUMN \"expense_requisite_snapshots\".\"data\" IS 'Снимок данных платёжного метода на момент создания СЗ'; COMMENT ON COLUMN \"expense_requisite_snapshots\".\"requisites\" IS 'Реквизиты строкой — как в документе СЗ'; COMMENT ON COLUMN \"expense_requisite_snapshots\".\"payment_purpose\" IS 'Назначение платежа (оплата по счёту) — для поручения кассиру'",
  "ALTER TABLE \"expense_files\" ADD COLUMN IF NOT EXISTS \"id\" SERIAL NOT NULL",
  "ALTER TABLE \"expense_files\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying NOT NULL",
  "ALTER TABLE \"expense_files\" ADD COLUMN IF NOT EXISTS \"proposal_hash\" character varying NOT NULL",
  "ALTER TABLE \"expense_files\" ADD COLUMN IF NOT EXISTS \"item_hash\" character varying",
  "ALTER TABLE \"expense_files\" ADD COLUMN IF NOT EXISTS \"kind\" \"public\".\"expense_files_kind_enum\" NOT NULL",
  "ALTER TABLE \"expense_files\" ADD COLUMN IF NOT EXISTS \"checksum_sha256\" character varying(64) NOT NULL",
  "ALTER TABLE \"expense_files\" ADD COLUMN IF NOT EXISTS \"mime_type\" character varying(120) NOT NULL",
  "ALTER TABLE \"expense_files\" ADD COLUMN IF NOT EXISTS \"size_bytes\" integer NOT NULL",
  "ALTER TABLE \"expense_files\" ADD COLUMN IF NOT EXISTS \"storage_key\" character varying(512) NOT NULL",
  "ALTER TABLE \"expense_files\" ADD COLUMN IF NOT EXISTS \"original_filename\" character varying(255)",
  "ALTER TABLE \"expense_files\" ADD COLUMN IF NOT EXISTS \"uploaded_by_username\" character varying NOT NULL",
  "ALTER TABLE \"expense_files\" ADD COLUMN IF NOT EXISTS \"uploaded_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"expense_plans\" ADD COLUMN IF NOT EXISTS \"id\" SERIAL NOT NULL",
  "ALTER TABLE \"expense_plans\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying(13) NOT NULL",
  "ALTER TABLE \"expense_plans\" ADD COLUMN IF NOT EXISTS \"braname\" character varying(13)",
  "ALTER TABLE \"expense_plans\" ADD COLUMN IF NOT EXISTS \"title\" character varying(500) NOT NULL",
  "ALTER TABLE \"expense_plans\" ADD COLUMN IF NOT EXISTS \"amount\" numeric(20,4) NOT NULL",
  "ALTER TABLE \"expense_plans\" ADD COLUMN IF NOT EXISTS \"due_date\" TIMESTAMP WITH TIME ZONE",
  "ALTER TABLE \"expense_plans\" ADD COLUMN IF NOT EXISTS \"recurrence\" character varying(16) NOT NULL DEFAULT 'NONE'",
  "ALTER TABLE \"expense_plans\" ADD COLUMN IF NOT EXISTS \"next_spawned\" boolean NOT NULL DEFAULT false",
  "ALTER TABLE \"expense_plans\" ADD COLUMN IF NOT EXISTS \"proposal_hash\" character varying(64)",
  "ALTER TABLE \"expense_plans\" ADD COLUMN IF NOT EXISTS \"paid_at\" TIMESTAMP WITH TIME ZONE",
  "ALTER TABLE \"expense_plans\" ADD COLUMN IF NOT EXISTS \"pay_to\" character varying(1000) NOT NULL",
  "ALTER TABLE \"expense_plans\" ADD COLUMN IF NOT EXISTS \"creator\" character varying(13) NOT NULL",
  "ALTER TABLE \"expense_plans\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
  "ALTER TABLE \"expense_plans\" ADD COLUMN IF NOT EXISTS \"updated_at\" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"_id\" uuid NOT NULL DEFAULT uuid_generate_v4()",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"block_num\" integer NOT NULL DEFAULT '0'",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"present\" boolean NOT NULL DEFAULT false",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"status\" character varying NOT NULL DEFAULT 'UNDEFINED'",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"_created_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"_updated_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"id\" integer",
  "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '\"expense_proposals\"'::regclass AND conname = 'UQ_4036495a1023afd7a245e246552') AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'UQ_4036495a1023afd7a245e246552' AND relkind = 'i') THEN ALTER TABLE \"expense_proposals\" ADD CONSTRAINT \"UQ_4036495a1023afd7a245e246552\" UNIQUE (\"id\"); END IF; END $$",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"proposal_hash\" character varying NOT NULL",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying NOT NULL",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"username\" character varying NOT NULL",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"source_wallet\" character varying NOT NULL",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"blockchain_status\" integer",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"items\" jsonb",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"total_planned\" character varying NOT NULL",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"total_actual\" character varying NOT NULL",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"callback\" jsonb",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"statement_doc\" jsonb",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"decision_doc\" jsonb",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP",
  "ALTER TABLE \"expense_proposals\" ADD COLUMN IF NOT EXISTS \"updated_at\" TIMESTAMP",
  "ALTER TABLE \"expense_requisite_snapshots\" ADD COLUMN IF NOT EXISTS \"id\" SERIAL NOT NULL",
  "ALTER TABLE \"expense_requisite_snapshots\" ADD COLUMN IF NOT EXISTS \"coopname\" character varying NOT NULL",
  "ALTER TABLE \"expense_requisite_snapshots\" ADD COLUMN IF NOT EXISTS \"proposal_hash\" character varying NOT NULL",
  "ALTER TABLE \"expense_requisite_snapshots\" ADD COLUMN IF NOT EXISTS \"item_hash\" character varying NOT NULL",
  "ALTER TABLE \"expense_requisite_snapshots\" ADD COLUMN IF NOT EXISTS \"recipient\" character varying NOT NULL",
  "ALTER TABLE \"expense_requisite_snapshots\" ADD COLUMN IF NOT EXISTS \"method_id\" character varying",
  "ALTER TABLE \"expense_requisite_snapshots\" ADD COLUMN IF NOT EXISTS \"method_type\" character varying",
  "ALTER TABLE \"expense_requisite_snapshots\" ADD COLUMN IF NOT EXISTS \"data\" jsonb",
  "ALTER TABLE \"expense_requisite_snapshots\" ADD COLUMN IF NOT EXISTS \"requisites\" text NOT NULL",
  "ALTER TABLE \"expense_requisite_snapshots\" ADD COLUMN IF NOT EXISTS \"payment_purpose\" text",
  "ALTER TABLE \"expense_requisite_snapshots\" ADD COLUMN IF NOT EXISTS \"created_at\" TIMESTAMP NOT NULL DEFAULT now()",
  "CREATE INDEX IF NOT EXISTS \"idx_expense_files_item\" ON \"expense_files\" (\"coopname\", \"proposal_hash\", \"item_hash\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_expense_files_proposal\" ON \"expense_files\" (\"coopname\", \"proposal_hash\") ",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"uq_expense_files_checksum\" ON \"expense_files\" (\"coopname\", \"checksum_sha256\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_expense_plans_coop_branch\" ON \"expense_plans\" (\"coopname\", \"braname\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_expense_proposals_created_at\" ON \"expense_proposals\" (\"_created_at\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_expense_proposals_status\" ON \"expense_proposals\" (\"status\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_expense_proposals_coopname_username\" ON \"expense_proposals\" (\"coopname\", \"username\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_expense_proposals_proposal_hash\" ON \"expense_proposals\" (\"proposal_hash\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_expense_proposals_blockchain_id\" ON \"expense_proposals\" (\"id\") ",
  "CREATE INDEX IF NOT EXISTS \"idx_expense_requisite_snapshots_proposal\" ON \"expense_requisite_snapshots\" (\"coopname\", \"proposal_hash\") ",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"uq_expense_requisite_snapshots_item\" ON \"expense_requisite_snapshots\" (\"coopname\", \"proposal_hash\", \"item_hash\") ",
];

export class ExpensesBaseline1790197276756 implements MigrationInterface {
  name = 'ExpensesBaseline1790197276756';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error('ExpensesBaseline1790197276756 не откатывается: удаление таблиц стартовой миграции стёрло бы данные');
  }
}
