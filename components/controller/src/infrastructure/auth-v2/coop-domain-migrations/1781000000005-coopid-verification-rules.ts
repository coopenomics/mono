import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * CoopID Story 4.2: per-coop правила применения типов верификации. Таблица
 * `verification_rules` в coop_domain_db — одна запись на действие (action_code =
 * открытый идентификатор, PRIMARY KEY). `required_types` — обязательные типы
 * верификации (`text[]`). Отсутствие записи = действие без ограничений по верификации.
 *
 * Перенесена дословно из миграции данных `V2.4.5__coopid_verification_rules.ts` (учёт `2.4.5`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainVerificationRules1781000000005 implements SchemaMigration {
  name = 'CoopDomainVerificationRules1781000000005';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS verification_rules (
        action_code text PRIMARY KEY,
        required_types text[] NOT NULL DEFAULT '{}',
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }
}
