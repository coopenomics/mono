import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * CoopID Story 6.8: multi-party critical actions. Таблица `pending_critical_actions`
 * в coop_domain_db: критическое действие (исключение пайщика, смена ролей совета,
 * force-recovery, смена типов верификации) живёт в pending-состоянии до сбора 2 подписей
 * (инициатор + ≥1 член совета) в окне ≤24ч, иначе истекает. `confirmations` — jsonb-массив
 * `{by, at}`; `payload` — параметры действия (хэшируется в audit при финализации, Story 6.10).
 *
 * Перенесена дословно из миграции данных `V2.4.9__coopid_pending_critical_actions.ts` (учёт `2.4.9`): таблицы
 * coop_domain_db — схема, и применяет их сам контроллер при старте. На узле,
 * где миграция данных уже прошла, она не повторяется: учёт переносится.
 */
export class CoopDomainPendingCriticalActions1781000000009 implements SchemaMigration {
  name = 'CoopDomainPendingCriticalActions1781000000009';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS pending_critical_actions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        action_type text NOT NULL,
        actor_id text NOT NULL,
        target_id text NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        status text NOT NULL DEFAULT 'pending',
        confirmations jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        finalized_at timestamptz
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pending_critical_actions_status ON pending_critical_actions (status, expires_at);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_pending_critical_actions_target ON pending_critical_actions (target_id);`);
  }
}
