/**
 * Исполнитель миграций схемы (C28-81): лента по метке времени в имени,
 * применённые пропускаются, каждая миграция — в своей транзакции вместе с
 * записью об её применении.
 */
import { resetExtensionDatabaseMigrations, registerExtensionDatabaseMigrations } from '@coopenomics/extension-kit';
import { runSchemaMigrations, pendingSchemaMigrations } from '~/infrastructure/database/schema/schema-migrations';

jest.mock('~/infrastructure/database/migrations', () => ({
  coreDatabaseMigrations: [
    class CoreLater1700000000003 {
      name = 'CoreLater1700000000003';
      async up(runner: { query(sql: string): Promise<unknown> }) {
        await runner.query('CORE LATER');
      }
    },
    class CoreFirst1700000000001 {
      name = 'CoreFirst1700000000001';
      async up(runner: { query(sql: string): Promise<unknown> }) {
        await runner.query('CORE FIRST');
      }
    },
  ],
}));

function fakePool(applied: string[], failOn?: string) {
  const log: string[] = [];
  const client = {
    query: jest.fn(async (sql: string, parameters?: unknown[]) => {
      log.push(parameters ? `${sql} ${JSON.stringify(parameters)}` : sql);
      if (failOn && sql === failOn) throw new Error('migration failed');
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  const pool = {
    query: jest.fn(async (sql: string) => ({ rows: sql.startsWith('SELECT') ? applied.map((name) => ({ name })) : [] })),
    connect: jest.fn(async () => client),
  };
  return { pool: pool as never, client, log };
}

describe('миграции схемы', () => {
  beforeEach(() => {
    resetExtensionDatabaseMigrations();
    registerExtensionDatabaseMigrations([
      class ExtensionMiddle1700000000002 {
        name = 'ExtensionMiddle1700000000002';
        async up(runner: { query(sql: string): Promise<unknown> }) {
          await runner.query('EXTENSION');
        }
      } as never,
    ]);
  });

  afterAll(() => resetExtensionDatabaseMigrations());

  it('непринятые миграции ядра и расширений идут одной лентой по метке времени, каждая в своей транзакции', async () => {
    const { pool, log, client } = fakePool(['CoreFirst1700000000001']);
    const progress: string[] = [];

    const applied = await runSchemaMigrations(pool, (name, index, total) => progress.push(`${index}/${total} ${name}`));

    expect(applied).toEqual(['ExtensionMiddle1700000000002', 'CoreLater1700000000003']);
    expect(log).toEqual([
      'BEGIN',
      'EXTENSION',
      'INSERT INTO "schema_migrations" ("timestamp", "name") VALUES ($1, $2) [1700000000002,"ExtensionMiddle1700000000002"]',
      'COMMIT',
      'BEGIN',
      'CORE LATER',
      'INSERT INTO "schema_migrations" ("timestamp", "name") VALUES ($1, $2) [1700000000003,"CoreLater1700000000003"]',
      'COMMIT',
    ]);
    expect(progress).toEqual(['1/2 ExtensionMiddle1700000000002', '2/2 CoreLater1700000000003']);
    expect(client.release).toHaveBeenCalledTimes(2);
  });

  it('упавшая миграция откатывается целиком и останавливает ленту; учёт о ней не пишется', async () => {
    const { pool, log, client } = fakePool([], 'EXTENSION');

    await expect(runSchemaMigrations(pool)).rejects.toThrow('migration failed');

    expect(log.filter((entry) => entry.startsWith('INSERT'))).toHaveLength(1);
    expect(log[log.length - 1]).toBe('ROLLBACK');
    expect(log).not.toContain('CORE LATER');
    expect(client.release).toHaveBeenCalledTimes(2);
  });

  it('всё применено — применять нечего', async () => {
    const { pool, client } = fakePool(['CoreFirst1700000000001', 'ExtensionMiddle1700000000002', 'CoreLater1700000000003']);

    await expect(runSchemaMigrations(pool)).resolves.toEqual([]);
    await expect(pendingSchemaMigrations(pool)).resolves.toEqual([]);
    expect(client.query).not.toHaveBeenCalled();
  });
});
