import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID: 2FA-вход пишет в аудит записи с result='pending' (challenge выдан,
 * вход ещё не завершён), а CHECK-ограничение audit_events знало только
 * success/failure/degraded — вставки молча отваливались (safeAudit глотает).
 * Расширяем ограничение; на партиционированной таблице ALTER родителя
 * распространяется на партиции.
 */
export default {
  name: 'coopid: audit_events result += pending (2FA-вход)',

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
      await db.query(`ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_result_check;`);
      await db.query(`
        ALTER TABLE audit_events ADD CONSTRAINT audit_events_result_check
          CHECK (result = ANY (ARRAY['success'::text, 'failure'::text, 'degraded'::text, 'pending'::text]));
      `);
      logger.info('audit_events_result_check расширен значением pending');
      return true;
    } catch (e) {
      logger.error(`audit result pending migration failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.14 не реализован.');
    return false;
  },
};
