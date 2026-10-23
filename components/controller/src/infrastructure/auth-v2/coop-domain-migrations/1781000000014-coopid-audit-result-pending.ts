import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * CoopID: 2FA-вход пишет в аудит записи с result='pending' (challenge выдан,
 * вход ещё не завершён), а CHECK-ограничение audit_events знало только
 * success/failure/degraded — вставки молча отваливались (safeAudit глотает).
 * Расширяем ограничение; на партиционированной таблице ALTER родителя
 * распространяется на партиции.
 *
 * Перенесена дословно из миграции данных `V2.4.14__coopid_audit_result_pending.ts` (учёт `2.4.14`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainAuditResultPending1781000000014 implements SchemaMigration {
  name = 'CoopDomainAuditResultPending1781000000014';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_result_check;`);
    await queryRunner.query(`
      ALTER TABLE audit_events ADD CONSTRAINT audit_events_result_check
        CHECK (result = ANY (ARRAY['success'::text, 'failure'::text, 'degraded'::text, 'pending'::text]));
    `);
  }
}
