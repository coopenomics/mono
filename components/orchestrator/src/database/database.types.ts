import type { ColumnType, Generated } from 'kysely';

/** Время с умолчанием `now()` в базе: при вставке необязательно. */
type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

/**
 * Регистр subgraph'ов кооператива. Apollo Gateway читает активные записи и
 * пересобирает supergraph.
 *
 * package_id — `@scope/name` пакета каталога (для ядра — `core@coopback`);
 * url — адрес субграфа внутри docker-сети; active — участвует ли субграф в
 * supergraph (false — расширение снято).
 */
export interface SubgraphRegistryTable {
  package_id: string;
  version: string;
  url: string;
  active: Generated<boolean>;
  health_status: Generated<string>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** Учёт применённых миграций схемы оркестратора. */
export interface OrchestratorSchemaMigrationsTable {
  name: string;
  applied_at: Timestamp;
}

export interface OrchestratorDB {
  subgraph_registry: SubgraphRegistryTable;
  orchestrator_schema_migrations: OrchestratorSchemaMigrationsTable;
}
