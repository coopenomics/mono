import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID Story 3.6: второй фактор (TOTP / Google Authenticator). Таблица
 * `two_factor` в coop_domain_db — один секрет на пайщика (subject_id = user.id).
 * `secret_enc` — Base32-секрет, зашифрованный server-key (aes.ts); сервер обязан
 * его читать, чтобы проверять коды (это НЕ ключ пайщика — инвариант vault цел).
 * `enabled=false` — секрет выпущен, но enrollment ещё не подтверждён первым кодом.
 */
export default {
  name: 'coopid: two_factor (TOTP secrets)',

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
        CREATE TABLE IF NOT EXISTS two_factor (
          subject_id text PRIMARY KEY,
          secret_enc text NOT NULL,
          enabled boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now(),
          confirmed_at timestamptz
        );
      `);
      logger.info('two_factor создана');
      return true;
    } catch (e) {
      logger.error(`two_factor migration failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.2 не реализован.');
    return false;
  },
};
