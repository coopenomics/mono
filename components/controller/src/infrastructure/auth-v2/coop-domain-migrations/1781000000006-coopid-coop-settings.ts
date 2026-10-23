import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * CoopID Story 4.6: настройки кооператива в coop_domain_db (таблица `coop_settings`).
 * Singleton-строка (`id = 1`) — coop_domain_db обслуживает один кооператив, поэтому
 * глобальные настройки = одна запись; новые настройки добавляются колонками.
 * `cert_ttl_seconds` — срок жизни participant_certificate (default 3600 = 1ч);
 * короткий TTL ограничивает окно атаки при компрометации ключа (Story 4.6 AC).
 *
 * Перенесена дословно из миграции данных `V2.4.6__coopid_coop_settings.ts` (учёт `2.4.6`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainCoopSettings1781000000006 implements SchemaMigration {
  name = 'CoopDomainCoopSettings1781000000006';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS coop_settings (
        id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        cert_ttl_seconds integer NOT NULL DEFAULT 3600,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`INSERT INTO coop_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
  }
}
