import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type Driver,
  type KyselyPlugin,
  type QueryResult,
} from 'kysely';
import type { DB } from '~/infrastructure/database/kysely/database.types';

export interface RecordedQuery {
  sql: string;
  parameters: readonly unknown[];
}

/** Ответ базы на очередной запрос: строки и, для записи, число затронутых строк. */
export interface ScriptedResult {
  rows?: Record<string, unknown>[];
  affected?: number;
}

class RecordingConnection implements DatabaseConnection {
  constructor(private readonly queries: RecordedQuery[], private readonly results: ScriptedResult[]) {}

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    this.queries.push({ sql: compiledQuery.sql, parameters: compiledQuery.parameters });
    const next = this.results.shift() ?? {};
    return {
      rows: (next.rows ?? []) as R[],
      ...(next.affected !== undefined ? { numAffectedRows: BigInt(next.affected) } : {}),
    };
  }

  // eslint-disable-next-line require-yield
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('streamQuery is not supported by the recording driver');
  }
}

class RecordingDriver implements Driver {
  private readonly connection: RecordingConnection;

  constructor(queries: RecordedQuery[], results: ScriptedResult[]) {
    this.connection = new RecordingConnection(queries, results);
  }

  async init(): Promise<void> {
    // базы нет
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    return this.connection;
  }

  async beginTransaction(): Promise<void> {
    // транзакция в тесте — граница без действия
  }

  async commitTransaction(): Promise<void> {
    // см. beginTransaction
  }

  async rollbackTransaction(): Promise<void> {
    // см. beginTransaction
  }

  async releaseConnection(): Promise<void> {
    // соединение одно на весь тест
  }

  async destroy(): Promise<void> {
    // закрывать нечего
  }
}

/**
 * Kysely без базы для модульных тестов хранилищ: запросы собираются настоящим
 * компилятором Postgres и записываются; ответы базы задаются по порядку
 * запросов (по умолчанию — пустой результат). Проверяется то, что уйдёт в
 * базу, — текст запроса и его параметры — и разбор ответа хранилищем.
 * Плагины — те же, что у настоящего соединения (сигналы ленты изменений).
 */
export function recordingKysely(
  results: ScriptedResult[] = [],
  plugins: KyselyPlugin[] = []
): { db: Kysely<DB>; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];
  const db = new Kysely<DB>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new RecordingDriver(queries, [...results]),
      createIntrospector: (instance) => new PostgresIntrospector(instance),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins,
  });
  return { db, queries };
}
