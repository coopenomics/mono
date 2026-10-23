import type { DataSource } from '../src/infrastructure/database/postgres/postgres-connection';

type MigrationLogger = { info: (message: string) => void; error: (message: string) => void; warn: (message: string) => void };

/**
 * Приводит поле users.email к нижнему регистру (и trim).
 * Если после нормализации два пользователя совпали бы по email — миграция не применяется (нужно вручную устранить дубликаты).
 */
export default {
  name: 'Нормализация email пользователей (lowercase)',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    try {
      logger.info('Проверка дубликатов email без учёта регистра...');

      const dupes: Array<{
        normalized_email: string;
        cnt: number;
        ids: string[];
        usernames: string[];
      }> = await dataSource.query(`
        SELECT LOWER(TRIM(email)) AS normalized_email, COUNT(*)::int AS cnt,
               array_agg(id::text ORDER BY created_at) AS ids,
               array_agg(username ORDER BY created_at) AS usernames
        FROM users
        WHERE email IS NOT NULL AND TRIM(email) <> ''
        GROUP BY LOWER(TRIM(email))
        HAVING COUNT(*) > 1
      `);

      if (dupes.length > 0) {
        logger.error(
          'Миграция остановлена: несколько записей users с одним email (без учёта регистра). Устраните дубликаты вручную, затем повторите запуск. Данные: ' +
            JSON.stringify(dupes)
        );
        return false;
      }

      await dataSource.query(`
        UPDATE users
        SET email = LOWER(TRIM(email))
        WHERE email IS NOT NULL AND email <> LOWER(TRIM(email))
      `);

      logger.info('Поле users.email приведено к LOWER(TRIM(...)) для всех отличающихся строк.');
      return true;
    } catch (e) {
      logger.error(`Ошибка миграции нормализации email: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  },

  async down({ logger }: { logger: MigrationLogger }): Promise<boolean> {
    logger.warn('Откат невозможен: исходный регистр символов в email не сохранялся.');
    return true;
  },
};
