/**
 * Общие части команд `schema:*` (C28-79): временные базы, владельцы таблиц,
 * разница «сущности против базы».
 *
 * Порядок импортов важен: настройки контура и реестр расширений заполняют
 * состав сущностей и миграций раньше, чем кто-то спросит подключение.
 */
import 'reflect-metadata';
import '~/config/platform-bootstrap';
import '~/extensions/extensions.registry';
import fs from 'node:fs';
import path from 'node:path';
import { DataSource } from 'typeorm';
import config from '~/config/config';
import { mainDataSourceOptions } from '~/infrastructure/database/typeorm/data-source.options';
import { statementTable } from '~/infrastructure/database/schema/idempotent-ddl';

export const CONTROLLER_ROOT = path.join(__dirname, '..');
export const EXTENSIONS_DIR = path.join(CONTROLLER_ROOT, 'src/extensions');
export const CORE_OWNER = 'core';

/** Служебное подключение к кластеру — для создания и удаления временных баз. */
async function admin<T>(run: (query: (sql: string) => Promise<unknown>) => Promise<T>): Promise<T> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: config.postgres.host,
    port: Number(config.postgres.port),
    username: config.postgres.username,
    password: config.postgres.password,
    database: 'postgres',
  });
  await dataSource.initialize();
  try {
    return await run((sql) => dataSource.query(sql));
  } finally {
    await dataSource.destroy();
  }
}

/**
 * Выполнить работу на чистой временной базе и удалить её после.
 * `SCHEMA_KEEP_SCRATCH=1` оставляет базу для разбора.
 */
export async function withScratchDatabase<T>(name: string, work: (database: string) => Promise<T>): Promise<T> {
  const database = `${name}_${process.pid}`;
  await admin((query) => query(`DROP DATABASE IF EXISTS "${database}"`));
  await admin((query) => query(`CREATE DATABASE "${database}"`));
  try {
    return await work(database);
  } finally {
    if (process.env.SCHEMA_KEEP_SCRATCH !== '1') {
      await admin((query) => query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`));
    } else {
      process.stderr.write(`Временная база оставлена: ${database}\n`);
    }
  }
}

/** Подключение к базе с составом приложения; `run` получает инициализированный DataSource. */
export async function withDataSource<T>(database: string, run: (dataSource: DataSource) => Promise<T>): Promise<T> {
  const dataSource = new DataSource(mainDataSourceOptions(database));
  await dataSource.initialize();
  try {
    return await run(dataSource);
  } finally {
    await dataSource.destroy();
  }
}

/** SQL, которым TypeORM привёл бы базу к сущностям (без выполнения). */
export async function pendingSchemaSql(dataSource: DataSource): Promise<{ up: string[]; down: string[] }> {
  const log = await dataSource.driver.createSchemaBuilder().log();
  return {
    up: log.upQueries.map((query) => query.query),
    down: log.downQueries.map((query) => query.query),
  };
}

export interface SchemaOwner {
  /** `core` либо имя каталога расширения. */
  name: string;
  /** Классы сущностей владельца (для ядра — пусто: ядро = всё остальное). */
  entities: ReadonlyArray<unknown>;
}

/**
 * Владельцы таблиц: каждое расширение — по своей декларации
 * `src/extensions/<имя>/<имя>.entities.ts`, ядро — всё остальное. Каталог
 * читается целиком, поэтому новое расширение подхватывается без правки здесь.
 */
export function loadOwners(): SchemaOwner[] {
  const owners: SchemaOwner[] = [];
  for (const dir of fs.readdirSync(EXTENSIONS_DIR).sort()) {
    const file = path.join(EXTENSIONS_DIR, dir, `${dir}.entities.ts`);
    if (!fs.existsSync(file)) continue;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require(file) as Record<string, unknown>;
    const list = Object.values(module).find(Array.isArray) as unknown[] | undefined;
    if (!list) throw new Error(`В ${file} нет экспортированного списка сущностей`);
    owners.push({ name: dir, entities: list });
  }
  return owners;
}

/** Таблица → владелец для подключения `dataSource`. */
export function tableOwners(dataSource: DataSource, owners: SchemaOwner[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const metadata of dataSource.entityMetadatas) {
    if (metadata.tableType === 'view') continue;
    const owner = owners.find((candidate) => candidate.entities.includes(metadata.target));
    result.set(metadata.tableName, owner?.name ?? CORE_OWNER);
  }
  return result;
}

/** Владелец инструкции: по её таблице, а тип перечисления — по первой колонке, которая его использует. */
export function ownerOfStatement(sql: string, index: number, all: string[], ownerByTable: Map<string, string>): string {
  let table = statementTable(sql);
  if (!table) {
    const type = sql.match(/^CREATE TYPE ((?:"[^"]+"\.)?"[^"]+")/)?.[1];
    const user = type ? all.slice(index + 1).find((next) => next.includes(type)) : undefined;
    table = user ? statementTable(user) : null;
  }
  const owner = table ? ownerByTable.get(table) : undefined;
  if (!owner) throw new Error(`Не определён владелец инструкции: ${sql}`);
  return owner;
}

/** Значение из словаря; при отсутствии — создать и положить. */
export function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = create();
    map.set(key, value);
  }
  return value;
}

/** Каталог миграций владельца. */
export function migrationsDir(owner: string): string {
  return owner === CORE_OWNER
    ? path.join(CONTROLLER_ROOT, 'src/infrastructure/database/migrations')
    : path.join(EXTENSIONS_DIR, owner, 'migrations/database');
}

/** Имя класса владельца: `core` → `Core`, `soviet-robot` → `SovietRobot`. */
export function ownerClassPrefix(owner: string): string {
  return owner
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** Исходник файла миграции TypeORM с готовыми инструкциями. */
export function renderMigration(params: {
  className: string;
  description: string;
  up: string[];
  down: string[] | null;
}): string {
  const list = (items: string[]) => items.map((sql) => `  ${JSON.stringify(sql)},`).join('\n');
  const down =
    params.down === null
      ? `    throw new Error('${params.className} не откатывается: удаление таблиц стартовой миграции стёрло бы данные');`
      : `    for (const sql of DOWN) await queryRunner.query(sql);`;
  return `import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
${params.description
  .split('\n')
  .map((line) => ` * ${line}`.trimEnd())
  .join('\n')}
 *
 * Сгенерировано командой \`pnpm schema:${params.down === null ? 'baseline' : 'generate'}\` — SQL выписан TypeORM из сущностей.
 */
const UP: readonly string[] = [
${list(params.up)}
];
${params.down === null ? '' : `\nconst DOWN: readonly string[] = [\n${list(params.down)}\n];\n`}
export class ${params.className} implements MigrationInterface {
  name = '${params.className}';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(${params.down === null ? '_queryRunner' : 'queryRunner'}: QueryRunner): Promise<void> {
${down}
  }
}
`;
}
