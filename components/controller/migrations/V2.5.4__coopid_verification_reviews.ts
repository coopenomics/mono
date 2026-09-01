import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID, задача 105-29: журнал верификаций личности и очередь проверки советом.
 *
 * В цепи истории нет — вектор `verifications` хранит только текущее состояние,
 * а отзыв запись стирает. Поэтому «что, когда и кто» ведём здесь: строка
 * заводится в момент сверки на участке и доживает до решения совета.
 *
 * `photos` — снимки сверки (ключи в файловом хранилище кооператива). Хранятся
 * временно: после решения председателя массив опустошается, а сами объекты
 * удаляются из хранилища. Остаётся только факт сверки и её судьба.
 */
export default {
  name: 'coopid: verification_reviews',

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
        CREATE TABLE IF NOT EXISTS verification_reviews (
          id uuid PRIMARY KEY,
          username text NOT NULL,
          procedure text NOT NULL DEFAULT 'passport',
          braname text NOT NULL DEFAULT '',
          verificator text NOT NULL,
          status text NOT NULL,
          photos jsonb NOT NULL DEFAULT '[]'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          decided_by text,
          decided_at timestamptz,
          decision_reason text
        );
      `);
      await db.query(`CREATE INDEX IF NOT EXISTS verification_reviews_status_idx ON verification_reviews (status, created_at DESC);`);
      await db.query(`CREATE INDEX IF NOT EXISTS verification_reviews_username_idx ON verification_reviews (username, created_at DESC);`);
      logger.info('verification_reviews создана');
      return true;
    } catch (e) {
      logger.error(`verification_reviews migration failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.5.4 не реализован.');
    return false;
  },
};
