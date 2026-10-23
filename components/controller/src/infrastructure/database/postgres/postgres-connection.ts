import { Pool, type PoolClient, type QueryResult } from 'pg';
import config from '~/config/config';
import logger from '~/config/logger';

export interface PostgresConnectionOptions {
  /** Оставлено для совместимости с прежним описанием подключения: всегда `postgres`. */
  type?: 'postgres';
  host?: string;
  port?: number | string;
  username?: string;
  password?: string;
  database?: string;
}

/** Пул соединений основной базы кооператива. */
export function createMainPool(database: string = config.postgres.database): Pool {
  return createPool({
    host: config.postgres.host,
    port: config.postgres.port,
    username: config.postgres.username,
    password: config.postgres.password,
    database,
  });
}

export function createPool(options: PostgresConnectionOptions): Pool {
  const pool = new Pool({
    host: options.host,
    port: options.port === undefined ? undefined : Number(options.port),
    user: options.username,
    password: options.password,
    database: options.database,
  });
  // Обрыв простаивающего соединения пул сообщает событием; без слушателя оно уронило бы процесс.
  pool.on('error', (error) => logger.warn(`postgres idle connection error: ${error.message}`));
  return pool;
}

/**
 * Ответ запроса в прежнем виде: у выборки и вставки — строки, у правки и
 * удаления — пара «строки и число затронутых». На этот вид рассчитаны
 * замороженные миграции данных и конфигурации расширений.
 */
function legacyResult(result: QueryResult): unknown {
  return result.command === 'UPDATE' || result.command === 'DELETE' ? [result.rows, result.rowCount ?? 0] : result.rows;
}

/** Одно соединение с ручным управлением транзакцией — для миграций данных. */
export class PostgresQueryRunner {
  private client: PoolClient | null = null;

  constructor(private readonly pool: Pool) {}

  async connect(): Promise<void> {
    this.client ??= await this.pool.connect();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query(sql: string, parameters?: unknown[]): Promise<any> {
    await this.connect();
    return legacyResult(await (this.client as PoolClient).query(sql, parameters));
  }

  async startTransaction(): Promise<void> {
    await this.query('BEGIN');
  }

  async commitTransaction(): Promise<void> {
    await this.query('COMMIT');
  }

  async rollbackTransaction(): Promise<void> {
    await this.query('ROLLBACK');
  }

  async release(): Promise<void> {
    this.client?.release();
    this.client = null;
  }
}

/**
 * Подключение к базе Postgres для миграций данных и служебных команд: готовые
 * запросы и ручные транзакции поверх драйвера `pg`. Имя и поведение методов
 * повторяют прежнее подключение, которым пользуются замороженные миграции.
 */
export class DataSource {
  private pool: Pool | null = null;

  constructor(private readonly options: PostgresConnectionOptions) {}

  get isInitialized(): boolean {
    return this.pool !== null;
  }

  async initialize(): Promise<this> {
    if (!this.pool) {
      this.pool = createPool(this.options);
      // Проверка связи сразу: недоступная база видна на подключении, а не на первом запросе.
      await this.pool.query('SELECT 1');
    }
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async query(sql: string, parameters?: unknown[]): Promise<any> {
    return legacyResult(await this.connected().query(sql, parameters));
  }

  createQueryRunner(): PostgresQueryRunner {
    return new PostgresQueryRunner(this.connected());
  }

  async destroy(): Promise<void> {
    const pool = this.pool;
    this.pool = null;
    await pool?.end();
  }

  private connected(): Pool {
    if (!this.pool) throw new Error('Postgres connection is not initialized');
    return this.pool;
  }
}
