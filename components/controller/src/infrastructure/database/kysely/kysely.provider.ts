import type { Provider } from '@nestjs/common';
import { Kysely, PostgresDialect, type PostgresPool } from 'kysely';
import { DataSource, type EntityManager } from 'typeorm';
import type { DB } from './database.types';
import { BoundConnectionDialect, type PgQueryable } from './bound-connection.dialect';
import { KYSELY, type Database } from './kysely.tokens';

/**
 * Kysely работает на том же пуле соединений, что и TypeORM: на время перехода
 * (C28-81) у базы один пул и один предел соединений. Пул закрывает TypeORM,
 * поэтому `destroy()` у этого экземпляра не зовут.
 */
export function createKysely(dataSource: DataSource): Database {
  const pool = (dataSource.driver as unknown as { master: PostgresPool }).master;
  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}

/**
 * Kysely на соединении транзакции TypeORM. Запросы обоих идут одной
 * транзакцией: фиксирует и откатывает её TypeORM.
 *
 * ```ts
 * await dataSource.transaction(async (manager) => {
 *   await manager.save(entity);
 *   await kyselyIn(manager).insertInto('tracking_rules').values(row).execute();
 * });
 * ```
 */
export async function kyselyIn(manager: EntityManager): Promise<Database> {
  const runner = manager.queryRunner;
  if (!runner?.isTransactionActive) {
    throw new Error('kyselyIn: the manager has no active transaction');
  }
  const client = (await runner.connect()) as PgQueryable;
  return new Kysely<DB>({ dialect: new BoundConnectionDialect(client) });
}

export const kyselyProvider: Provider = {
  provide: KYSELY,
  inject: [DataSource],
  useFactory: createKysely,
};
