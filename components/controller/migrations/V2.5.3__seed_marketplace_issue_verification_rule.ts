import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * Верификация личности (105-28): выдача имущества на кооперативном участке
 * требует базового уровня верификации получателя (`passport_onsite` — личность
 * сверена с паспортом председателем участка или доверенным лицом). Правило
 * сидируется один раз и дальше управляется кооперативом через verification_rules;
 * существующая запись не перезаписывается.
 */
export default {
  name: 'верификация: правило выдачи имущества (passport_onsite)',

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
        INSERT INTO verification_rules (action_code, required_types)
        VALUES ('marketplace.issue_property', '{passport_onsite}')
        ON CONFLICT (action_code) DO NOTHING;
      `);
      logger.info('правило marketplace.issue_property → passport_onsite посеяно');
      return true;
    } catch (e) {
      logger.error(`seed verification rule failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.5.3 не реализован.');
    return false;
  },
};
