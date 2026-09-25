import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * Код приложения-аутентификатора принимается один раз: в `two_factor`
 * запоминается шаг времени последнего принятого кода (`last_used_step`), и
 * тот же код повторно не проходит. До 25.09.2026 один код годился дважды
 * подряд — подслушанный код давал второе действие.
 */
export default {
  name: 'coopid: two_factor.last_used_step (TOTP replay protection)',

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
      await db.query(`ALTER TABLE two_factor ADD COLUMN IF NOT EXISTS last_used_step bigint`);
      logger.info('two_factor.last_used_step добавлена');
      return true;
    } catch (e) {
      logger.error(`two_factor.last_used_step migration failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат 202609250900 не реализован.');
    return false;
  },
};
