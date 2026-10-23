import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * CoopID Story 4.7: manual revoke (compromised-key MVP). Таблица `revoked_keys` в
 * coop_domain_db фиксирует ручной отзыв ключа пайщика председателем: durable
 * pending-state (AC «или с переходом на pending state») — пока `recovered_at IS NULL`,
 * ключ пайщика считается отозванным и пайщик обязан пройти recovery (Эпик 3) для
 * получения нового. `reason`/`revoked_by` — для audit-трейла KeyRevokedManually.
 *
 * Перенесена дословно из миграции данных `V2.4.10__coopid_revoked_keys.ts` (учёт `2.4.10`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainRevokedKeys1781000000010 implements SchemaMigration {
  name = 'CoopDomainRevokedKeys1781000000010';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS revoked_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        target_id text NOT NULL,
        reason text NOT NULL,
        revoked_by text NOT NULL,
        revoked_at timestamptz NOT NULL DEFAULT now(),
        recovered_at timestamptz
      );
    `);
    // Активный отзыв (ожидает recovery) ищется по target_id + recovered_at IS NULL.
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_revoked_keys_target_active ON revoked_keys (target_id, recovered_at);`);
  }
}
