/**
 * Общие части команд `schema:*`: временная база, каталоги и заготовка миграции.
 */
// Настройки контура — раньше реестра: расширения читают их уже при импорте.
import '~/config/platform-bootstrap';
// Реестр расширений заполняет состав миграций расширений.
import '~/extensions/extensions.registry';
import path from 'node:path';
import { Client } from 'pg';
import config from '~/config/config';

export const CONTROLLER_ROOT = path.join(__dirname, '..');
export const EXTENSIONS_DIR = path.join(CONTROLLER_ROOT, 'src/extensions');
export const CORE_OWNER = 'core';

/** Служебное подключение к кластеру — для создания и удаления временных баз. */
async function admin(sql: string): Promise<void> {
  const client = new Client({
    host: config.postgres.host,
    port: Number(config.postgres.port),
    user: config.postgres.username,
    password: config.postgres.password,
    database: 'postgres',
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

/**
 * Выполнить работу на чистой временной базе и удалить её после.
 * `SCHEMA_KEEP_SCRATCH=1` оставляет базу для разбора.
 */
export async function withScratchDatabase<T>(name: string, work: (database: string) => Promise<T>): Promise<T> {
  const database = `${name}_${process.pid}`;
  await admin(`DROP DATABASE IF EXISTS "${database}"`);
  await admin(`CREATE DATABASE "${database}"`);
  try {
    return await work(database);
  } finally {
    if (process.env.SCHEMA_KEEP_SCRATCH !== '1') {
      await admin(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    } else {
      process.stderr.write(`Временная база оставлена: ${database}\n`);
    }
  }
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

/** Заготовка файла миграции схемы: инструкции SQL вписывает автор. */
export function renderMigration(params: { className: string; description: string }): string {
  return `import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
${params.description
  .split('\n')
  .map((line) => ` * ${line}`.trimEnd())
  .join('\n')}
 */
const UP: readonly string[] = [
  // Инструкции SQL по порядку. Переименование колонки — ALTER TABLE … RENAME COLUMN;
  // NOT NULL на заполненной таблице — в два шага: колонка, заполнение, ограничение.
];

const DOWN: readonly string[] = [];

export class ${params.className} implements SchemaMigration {
  name = '${params.className}';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
`;
}
