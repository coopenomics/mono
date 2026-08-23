import { DataSource } from 'typeorm';
import config from '../src/config/config';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * CoopID Story 6.11: назначаемые наборы возможностей (расширяемые роли). Председатель
 * назначает пайщику именованный НАБОР («бухгалтер»/«кассир»); правила набора живут в
 * `access_rules` (subject_type='capability_set', Story 6.2) — движок CASL переиспользуется.
 *
 *  - `capability_sets` — реестр шаблонов (платформенные seed + кооп-кастом).
 *  - `participant_capability_sets` — назначение пайщик→набор (UNIQUE username+set_key,
 *     revoked_at для отзыва, expires_at для TTL).
 *
 * Seed: два платформенных набора (accountant/cashier) + их правила доступа к столам.
 * Имена subject доступа (`AccountingDesk`/`PaymentRegistry`) — grant-строки для desktop
 * meta.requires; уточняются при разводке desktop-gating.
 */
export default {
  name: 'coopid: capability_sets',

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
        CREATE TABLE IF NOT EXISTS capability_sets (
          set_key text PRIMARY KEY,
          title text NOT NULL,
          description text NOT NULL DEFAULT '',
          builtin boolean NOT NULL DEFAULT false,
          coopname text,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS participant_capability_sets (
          id bigserial PRIMARY KEY,
          username text NOT NULL,
          set_key text NOT NULL,
          granted_by text NOT NULL,
          granted_at timestamptz NOT NULL DEFAULT now(),
          expires_at timestamptz,
          revoked_at timestamptz,
          CONSTRAINT uq_participant_capability_set UNIQUE (username, set_key)
        );
      `);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_participant_capability_sets_username ON participant_capability_sets (username);`);

      // --- Seed платформенных наборов (идемпотентно) ---
      await db.query(`
        INSERT INTO capability_sets (set_key, title, description, builtin, coopname) VALUES
          ('accountant', 'Бухгалтер', 'Доступ к столу бухгалтера (чтение реестра и связанных данных кооператива).', true, NULL),
          ('cashier', 'Кассир', 'Управление реестром платежей: подтверждение входящих и исходящих платежей.', true, NULL)
        ON CONFLICT (set_key) DO NOTHING;
      `);

      // --- Seed правил наборов в access_rules (идемпотентно через NOT EXISTS) ---
      const seedRules: Array<{ set: string; action: string; resource: string }> = [
        { set: 'accountant', action: 'read', resource: 'AccountingDesk' },
        { set: 'cashier', action: 'read', resource: 'PaymentRegistry' },
        { set: 'cashier', action: 'confirm', resource: 'PaymentRegistry' },
      ];
      for (const r of seedRules) {
        await db.query(
          `INSERT INTO access_rules (subject_type, subject_id, effect, action, resource_type, conditions, expires_at, updated_at)
           SELECT 'capability_set', $1, 'allow', $2, $3, NULL, NULL, now()
            WHERE NOT EXISTS (
              SELECT 1 FROM access_rules
               WHERE subject_type = 'capability_set' AND subject_id = $1
                 AND action = $2 AND resource_type = $3
            )`,
          [r.set, r.action, r.resource],
        );
      }

      logger.info('capability_sets + participant_capability_sets созданы, seed accountant/cashier применён');
      return true;
    } catch (e) {
      logger.error(`capability_sets migration failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      if (db.isInitialized) await db.destroy();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат V2.4.12 не реализован.');
    return false;
  },
};
