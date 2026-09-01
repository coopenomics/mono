import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID Story 2.1 (фикс схемы 1.4): cipher_version/kdf_version в `vaults` —
 * текстовые версии ('aes-256-gcm-v1' / 'argon2id-v1'), а не smallint.
 * V2.4.0 объявила их smallint по недосмотру; правим отдельной миграцией,
 * т.к. применённые миграции иммутабельны. Таблица на этом этапе пуста.
 */
export default {
  name: 'coopid: vaults.cipher_version/kdf_version → text',

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
      await db.query(`ALTER TABLE vaults ALTER COLUMN cipher_version TYPE text USING cipher_version::text`);
      await db.query(`ALTER TABLE vaults ALTER COLUMN kdf_version TYPE text USING kdf_version::text`);
      await db.query(`ALTER TABLE vaults ALTER COLUMN cipher_version SET DEFAULT 'aes-256-gcm-v1'`);
      await db.query(`ALTER TABLE vaults ALTER COLUMN kdf_version SET DEFAULT 'argon2id-v1'`);
      logger.info('vaults: cipher_version/kdf_version → text');
      return true;
    } catch (e) {
      logger.error(`vault version columns alter failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.1 не реализован.');
    return false;
  },
};
