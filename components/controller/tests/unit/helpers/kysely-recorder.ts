import { DummyDriver, Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from 'kysely';
import type { DB } from '~/infrastructure/database/kysely/database.types';

export interface RecordedQuery {
  sql: string;
  parameters: readonly unknown[];
}

/**
 * Kysely без базы для модульных тестов хранилищ: запросы собираются настоящим
 * компилятором Postgres и записываются, выполнение отдаёт пустой результат.
 * Проверяется то, что уйдёт в базу, — текст запроса и его параметры.
 */
export function recordingKysely(): { db: Kysely<DB>; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];
  const db = new Kysely<DB>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (instance) => new PostgresIntrospector(instance),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    log: (event) => {
      queries.push({ sql: event.query.sql, parameters: event.query.parameters });
    },
  });
  return { db, queries };
}
