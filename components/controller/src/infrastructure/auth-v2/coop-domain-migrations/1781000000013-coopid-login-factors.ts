import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * CoopID: настройки второго фактора входа (2FA-логин). Таблица `login_factors`
 * в coop_domain_db — одна запись на пайщика (subject_id = user.id). Флаги
 * независимы: totp_enabled — код из приложения-аутентификатора, email_enabled —
 * одноразовый код на подтверждённую почту. Отсутствие записи = 2FA-вход выключен.
 *
 * Перенесена дословно из миграции данных `V2.4.13__coopid_login_factors.ts` (учёт `2.4.13`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainLoginFactors1781000000013 implements SchemaMigration {
  name = 'CoopDomainLoginFactors1781000000013';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS login_factors (
        subject_id text PRIMARY KEY,
        totp_enabled boolean NOT NULL DEFAULT false,
        email_enabled boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }
}
