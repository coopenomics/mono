import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID Story 6.8: multi-party critical actions. Таблица `pending_critical_actions`
 * в coop_domain_db: критическое действие (исключение пайщика, смена ролей совета,
 * force-recovery, смена типов верификации) живёт в pending-состоянии до сбора 2 подписей
 * (инициатор + ≥1 член совета) в окне ≤24ч, иначе истекает. `confirmations` — jsonb-массив
 * `{by, at}`; `payload` — параметры действия (хэшируется в audit при финализации, Story 6.10).
 */
export default {
  name: 'coopid: pending_critical_actions',

  async up({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    const db = new DataSource({
      type: 'postgres',
      host: config.coopDomainDb.host,
      port: config.coopDomainDb.port,
      username: config.coopDomainDb.username,
      password: config.coopDomainDb.password,
      database: config.coopDomainDb.database,
    });
    try {
      await db.initialize();
      await db.query(`
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
      await db.query(`CREATE INDEX IF NOT EXISTS idx_pending_critical_actions_status ON pending_critical_actions (status, expires_at);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_pending_critical_actions_target ON pending_critical_actions (target_id);`);
      logger.info('pending_critical_actions создана');
      return true;
    } catch (e) {
      logger.error(`pending_critical_actions migration failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.9 не реализован.');
    return false;
  },
};
