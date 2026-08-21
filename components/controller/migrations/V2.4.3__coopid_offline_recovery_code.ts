import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID Story 3.4: альтернативный recovery по offline-коду. Таблица
 * `offline_recovery_code` в coop_domain_db — один код на пайщика (subject_id =
 * user.id). `code_hash` — keyed HMAC-SHA256(server_secret, code), детерминирован
 * для lookup по точному хешу; сырой код не хранится. Single-use: строка удаляется
 * после выдачи recovery-токена (см. OfflineRecoveryService).
 */
export default {
  name: 'coopid: offline_recovery_code',

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
        CREATE TABLE IF NOT EXISTS offline_recovery_code (
          subject_id text PRIMARY KEY,
          code_hash text NOT NULL UNIQUE,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      logger.info('offline_recovery_code создана');
      return true;
    } catch (e) {
      logger.error(`offline_recovery_code migration failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.3 не реализован.');
    return false;
  },
};
