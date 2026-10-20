import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * CoopID Story 3.5: стратегия восстановления пайщика. Таблица `recovery_strategy`
 * в coop_domain_db — одна запись на пайщика (subject_id = user.id). `strategy` —
 * один из email_magic_link|offline_code|council; отсутствие записи = дефолт
 * email_magic_link (обратная совместимость с 3.1).
 *
 * Перенесена дословно из миграции данных `V2.4.4__coopid_recovery_strategy.ts` (учёт `2.4.4`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainRecoveryStrategy1781000000004 implements SchemaMigration {
  name = 'CoopDomainRecoveryStrategy1781000000004';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recovery_strategy (
        subject_id text PRIMARY KEY,
        strategy text NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }
}
