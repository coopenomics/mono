import type { DataSource } from 'typeorm';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * Epic 2 Story 2.10: таблица ручных реквизитов кооператива для отчётности
 * ФНС/СФР. Хранит поля, отсутствующие в `IOrganizationData` (блокчейн):
 * ОКВЭД, ОКФС, ОКОПФ, ОКТМО, ОКПО, регномер СФР, должность руководителя,
 * СНИЛС подписанта, описание доверенности + override'ы телефона/адреса.
 *
 * Идемпотентна: `CREATE TABLE IF NOT EXISTS`.
 */
export default {
  name: 'Создание report_requisites (реквизиты кооператива для отчётности)',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    try {
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS "report_requisites" (
          "coopname"          varchar(64)  NOT NULL,
          "okved"             varchar(16)  NULL,
          "okfs"              varchar(8)   NULL,
          "okopf"             varchar(16)  NULL,
          "oktmo"             varchar(16)  NULL,
          "okpo"              varchar(16)  NULL,
          "sfr_reg_number"    varchar(32)  NULL,
          "chairman_position" varchar(255) NULL,
          "signer_snils"      varchar(32)  NULL,
          "signer_rep_doc"    varchar(255) NULL,
          "signer_type"       varchar(16)  NULL,
          "phone_override"    varchar(64)  NULL,
          "address_override"  varchar(512) NULL,
          "updated_by"        varchar(255) NOT NULL,
          "updated_at"        timestamptz  NOT NULL DEFAULT now(),
          CONSTRAINT "pk_report_requisites" PRIMARY KEY ("coopname")
        )
      `);
      // Идемпотентно добавляем signer_type для уже существующих БД.
      await dataSource.query(`
        ALTER TABLE "report_requisites"
        ADD COLUMN IF NOT EXISTS "signer_type" varchar(16) NULL
      `);
      logger.info('Таблица report_requisites создана (или уже существовала).');
      return true;
    } catch (e) {
      logger.error(`Ошибка миграции V2.0.1 (report_requisites): ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  },

  async down({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    try {
      await dataSource.query(`DROP TABLE IF EXISTS "report_requisites"`);
      logger.warn('Откат V2.0.1: таблица report_requisites удалена.');
      return true;
    } catch (e) {
      logger.error(`Ошибка отката V2.0.1: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  },
};
