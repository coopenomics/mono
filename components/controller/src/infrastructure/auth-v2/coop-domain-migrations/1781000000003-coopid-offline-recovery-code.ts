import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * CoopID Story 3.4: альтернативный recovery по offline-коду. Таблица
 * `offline_recovery_code` в coop_domain_db — один код на пайщика (subject_id =
 * user.id). `code_hash` — keyed HMAC-SHA256(server_secret, code), детерминирован
 * для lookup по точному хешу; сырой код не хранится. Single-use: строка удаляется
 * после выдачи recovery-токена (см. OfflineRecoveryService).
 *
 * Перенесена дословно из миграции данных `V2.4.3__coopid_offline_recovery_code.ts` (учёт `2.4.3`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainOfflineRecoveryCode1781000000003 implements SchemaMigration {
  name = 'CoopDomainOfflineRecoveryCode1781000000003';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS offline_recovery_code (
        subject_id text PRIMARY KEY,
        code_hash text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }
}
