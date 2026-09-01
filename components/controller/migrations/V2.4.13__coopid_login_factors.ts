import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID: настройки второго фактора входа (2FA-логин). Таблица `login_factors`
 * в coop_domain_db — одна запись на пайщика (subject_id = user.id). Флаги
 * независимы: totp_enabled — код из приложения-аутентификатора, email_enabled —
 * одноразовый код на подтверждённую почту. Отсутствие записи = 2FA-вход выключен.
 */
export default {
  name: 'coopid: login_factors (настройки 2FA-входа)',

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
        CREATE TABLE IF NOT EXISTS login_factors (
          subject_id text PRIMARY KEY,
          totp_enabled boolean NOT NULL DEFAULT false,
          email_enabled boolean NOT NULL DEFAULT false,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      logger.info('login_factors создана');
      return true;
    } catch (e) {
      logger.error(`login_factors migration failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.13 не реализован.');
    return false;
  },
};
