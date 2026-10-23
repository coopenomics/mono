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
      'SELECT pg_advisory_lock($1) [7301202610]',
      'BEGIN',
      'EXTENSION',
      'INSERT INTO "schema_migrations" ("timestamp", "name") VALUES ($1, $2) [1700000000002,"ExtensionMiddle1700000000002"]',
      'COMMIT',
      'BEGIN',
      'CORE LATER',
      'INSERT INTO "schema_migrations" ("timestamp", "name") VALUES ($1, $2) [1700000000003,"CoreLater1700000000003"]',
      'COMMIT',
      'SELECT pg_advisory_unlock($1) [7301202610]',
    ]);
    expect(progress).toEqual(['1/2 ExtensionMiddle1700000000002', '2/2 CoreLater1700000000003']);
    // Два соединения миграций и одно — блокировки.
    expect(client.release).toHaveBeenCalledTimes(3);
  });

  it('упавшая миграция откатывается целиком и останавливает ленту; учёт о ней не пишется', async () => {
    const { pool, log, client } = fakePool([], 'EXTENSION');

    await expect(runSchemaMigrations(pool)).rejects.toThrow('migration failed');

    expect(log.filter((entry) => entry.startsWith('INSERT'))).toHaveLength(1);
    // Откат — и блокировка всё равно снята: иначе следующий старт ждал бы её вечно.
    expect(log.slice(-2)).toEqual(['ROLLBACK', 'SELECT pg_advisory_unlock($1) [7301202610]']);
    expect(log).not.toContain('CORE LATER');
    expect(client.release).toHaveBeenCalledTimes(3);
  });

  it('всё применено — применять нечего', async () => {
    const { pool, log } = fakePool(['CoreFirst1700000000001', 'ExtensionMiddle1700000000002', 'CoreLater1700000000003']);

    await expect(runSchemaMigrations(pool)).resolves.toEqual([]);
    await expect(pendingSchemaMigrations(pool)).resolves.toEqual([]);
    // Только взять и снять блокировку — ни одной миграции.
    expect(log).toEqual(['SELECT pg_advisory_lock($1) [7301202610]', 'SELECT pg_advisory_unlock($1) [7301202610]']);
  });

  // Тестнет, 20.10.2026, установка 11743: контроллер при старте и мигратор
  // применяли схему одновременно, второй падал на «already exists».
  it('схема применяется под advisory-блокировкой: список применённых читается уже под ней', async () => {
    const order: string[] = [];
    const client = {
      query: jest.fn(async (sql: string) => {
        order.push(sql.startsWith('SELECT pg_advisory') ? sql.split('(')[0] : sql);
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    const pool = {
      query: jest.fn(async (sql: string) => {
        order.push(sql.startsWith('SELECT') ? 'читаем применённые' : 'учёт');
        return { rows: ['CoreFirst1700000000001', 'ExtensionMiddle1700000000002', 'CoreLater1700000000003'].map((name) => ({ name })) };
      }),
      connect: jest.fn(async () => client),
    };

    await runSchemaMigrations(pool as never);

    expect(order[0]).toBe('SELECT pg_advisory_lock');
    expect(order.indexOf('читаем применённые')).toBeGreaterThan(0);
    expect(order[order.length - 1]).toBe('SELECT pg_advisory_unlock');
  });
});
