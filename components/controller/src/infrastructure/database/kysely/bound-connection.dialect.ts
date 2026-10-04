import {
  CompiledQuery,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type Kysely,
  type QueryCompiler,
  type QueryResult,
} from 'kysely';

/** То, что нужно от соединения драйвера pg: один метод запроса. */
export interface PgQueryable {
  query(sql: string, parameters: unknown[]): Promise<{ command?: string; rowCount?: number | null; rows?: unknown[] }>;
}

class BoundConnection implements DatabaseConnection {
  constructor(private readonly client: PgQueryable) {}

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const result = await this.client.query(compiledQuery.sql, [...compiledQuery.parameters]);
    const rows = (result.rows ?? []) as R[];
    const changes = ['INSERT', 'UPDATE', 'DELETE', 'MERGE'].includes(result.command ?? '');
    return changes ? { numAffectedRows: BigInt(result.rowCount ?? 0), rows } : { rows };
  }

  // eslint-disable-next-line require-yield
  async *streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('Streaming is not supported on a TypeORM transaction connection');
  }
}

/**
 * Драйвер поверх уже открытого соединения. Границы транзакции держит тот, кто
 * соединение открыл (TypeORM): свою транзакцию здесь начать нельзя, иначе у
 * одной операции оказалось бы два хозяина.
 */
class BoundConnectionDriver implements Driver {
  private readonly connection: BoundConnection;

  constructor(client: PgQueryable) {
    this.connection = new BoundConnection(client);
  }

  async init(): Promise<void> {
    // соединение уже открыто
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    return this.connection;
  }

  async beginTransaction(): Promise<void> {
    throw new Error('TypeORM owns this transaction: a nested Kysely transaction is not allowed');
  }

  async commitTransaction(): Promise<void> {
    throw new Error('TypeORM owns this transaction');
  }

  async rollbackTransaction(): Promise<void> {
    throw new Error('TypeORM owns this transaction');
  }

  async releaseConnection(): Promise<void> {
    // соединение возвращает в пул его хозяин
  }

  async destroy(): Promise<void> {
    // соединение закрывает его хозяин
  }
}

export class BoundConnectionDialect implements Dialect {
  constructor(private readonly client: PgQueryable) {}

  createDriver(): Driver {
    return new BoundConnectionDriver(this.client);
  }

  createQueryCompiler(): QueryCompiler {
    return new PostgresQueryCompiler();
  }

  createAdapter(): DialectAdapter {
    return new PostgresAdapter();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new PostgresIntrospector(db);
  }
}
