import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID Story 4.7: manual revoke (compromised-key MVP). Таблица `revoked_keys` в
 * coop_domain_db фиксирует ручной отзыв ключа пайщика председателем: durable
 * pending-state (AC «или с переходом на pending state») — пока `recovered_at IS NULL`,
 * ключ пайщика считается отозванным и пайщик обязан пройти recovery (Эпик 3) для
 * получения нового. `reason`/`revoked_by` — для audit-трейла KeyRevokedManually.
 */
export default {
  name: 'coopid: revoked_keys',

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
      await db.query(`CREATE INDEX IF NOT EXISTS idx_revoked_keys_target_active ON revoked_keys (target_id, recovered_at);`);
      logger.info('revoked_keys создана');
      return true;
    } catch (e) {
      logger.error(`revoked_keys migration failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.10 не реализован.');
    return false;
  },
};
