import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * CoopID Story 3.6: второй фактор (TOTP / Google Authenticator). Таблица
 * `two_factor` в coop_domain_db — один секрет на пайщика (subject_id = user.id).
 * `secret_enc` — Base32-секрет, зашифрованный server-key (aes.ts); сервер обязан
 * его читать, чтобы проверять коды (это НЕ ключ пайщика — инвариант vault цел).
 * `enabled=false` — секрет выпущен, но enrollment ещё не подтверждён первым кодом.
 *
 * Перенесена дословно из миграции данных `V2.4.2__coopid_two_factor.ts` (учёт `2.4.2`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainTwoFactor1781000000002 implements SchemaMigration {
  name = 'CoopDomainTwoFactor1781000000002';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS two_factor (
        subject_id text PRIMARY KEY,
        secret_enc text NOT NULL,
        enabled boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        confirmed_at timestamptz
      );
    `);
  }
}
