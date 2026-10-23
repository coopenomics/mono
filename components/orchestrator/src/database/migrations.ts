import { sql, type Kysely } from 'kysely';
import type { OrchestratorDB } from './database.types';

/**
 * Миграции схемы оркестратора — в порядке появления. Таблицы оркестратора
 * живут в базе кооператива рядом с таблицами контроллера, но учёт у них свой
 * (`orchestrator_schema_migrations`): оркестратор — отдельный сервис и
 * выкатывается независимо от контроллера.
 */
interface OrchestratorMigration {
  name: string;
  up: readonly string[];
}

export const ORCHESTRATOR_MIGRATIONS: readonly OrchestratorMigration[] = [
  {
    name: '0001-subgraph-registry',
    up: [
      `CREATE TABLE IF NOT EXISTS "subgraph_registry" (
        "package_id" character varying(128) NOT NULL,
        "version" character varying(32) NOT NULL,
        "url" character varying(512) NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "health_status" character varying(16) NOT NULL DEFAULT 'unknown',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subgraph_registry" PRIMARY KEY ("package_id")
      )`,
    ],
  },
];

/**
 * Применить недостающие миграции. Каждая идёт в своей транзакции вместе с
 * записью об её применении, повторный запуск ничего не делает.
 */
export async function runOrchestratorMigrations(db: Kysely<OrchestratorDB>): Promise<string[]> {
  await sql`CREATE TABLE IF NOT EXISTS "orchestrator_schema_migrations" (
    "name" character varying(128) NOT NULL PRIMARY KEY,
    "applied_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  )`.execute(db);

  const applied = new Set(
    (await db.selectFrom('orchestrator_schema_migrations').select('name').execute()).map((row) => row.name),
  );
  const done: string[] = [];
  for (const migration of ORCHESTRATOR_MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    await db.transaction().execute(async (trx) => {
      for (const statement of migration.up) await sql.raw(statement).execute(trx);
      await trx.insertInto('orchestrator_schema_migrations').values({ name: migration.name }).execute();
    });
    done.push(migration.name);
  }
  return done;
}
