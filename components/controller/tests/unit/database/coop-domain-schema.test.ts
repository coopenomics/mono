/**
 * Схема базы CoopID (coop_domain_db) — миграциями схемы, которые контроллер
 * применяет при старте. До 20.10.2026 её вели миграции данных, а они на узле
 * идут только с выпуском: узел после первой установки стоял без таблиц CoopID,
 * и пароль по приглашению не задавался (тестнет, duhempijbika).
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { runCoopDomainSchemaMigrations } from '~/infrastructure/auth-v2/coop-domain-schema';

jest.mock('~/infrastructure/auth-v2/coop-domain-migrations', () => {
  const actual = jest.requireActual('~/infrastructure/auth-v2/coop-domain-migrations');
  return {
    ...actual,
    coopDomainDatabaseMigrations: [
      class Done1781000000001 {
        name = 'Done1781000000001';
        async up(runner: { query(sql: string): Promise<unknown> }) {
          await runner.query('DONE BEFORE');
        }
      },
      class Fresh1781000000002 {
        name = 'Fresh1781000000002';
        async up(runner: { query(sql: string): Promise<unknown> }) {
          await runner.query('FRESH');
        }
      },
    ],
    COOP_DOMAIN_LEGACY_VERSIONS: { Done1781000000001: '2.4.10', Fresh1781000000002: '2.4.11' },
  };
});

/** Пул coop_domain_db: учёт схемы пуст. */
function coopPool() {
  const log: string[] = [];
  const client = {
    query: jest.fn(async (sql: string) => {
      log.push(sql.startsWith('SELECT pg_advisory') ? sql.split('(')[0] : sql);
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  const pool = {
    query: jest.fn(async (sql: string, parameters?: unknown[]) => {
      if (sql.startsWith('INSERT')) log.push(`ОТМЕТКА ${String(parameters?.[1])}`);
      return { rows: [] };
    }),
    connect: jest.fn(async () => client),
  };
  return { pool: pool as never, log };
}

/** Пул основной базы с учётом миграций данных. */
function mainPool(legacy: string[] | null) {
  return {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('to_regclass')) return { rows: [{ exists: legacy !== null }] };
      return { rows: (legacy ?? []).map((version) => ({ version })) };
    }),
  } as never;
}

describe('схема базы CoopID', () => {
  it('миграция, уже прошедшая на узле миграцией данных, получает отметку и не выполняется повторно', async () => {
    const { pool, log } = coopPool();

    const applied = await runCoopDomainSchemaMigrations(pool, mainPool(['V2.4.10']));

    expect(applied).toEqual(['Fresh1781000000002']);
    expect(log).toContain('ОТМЕТКА Done1781000000001');
    expect(log).not.toContain('DONE BEFORE');
    expect(log).toContain('FRESH');
  });

  it('чистый узел: учёта миграций данных нет — выполняются все миграции схемы', async () => {
    const { pool, log } = coopPool();

    const applied = await runCoopDomainSchemaMigrations(pool, mainPool(null));

    expect(applied).toEqual(['Done1781000000001', 'Fresh1781000000002']);
    expect(log).toContain('DONE BEFORE');
    expect(log.filter((entry) => entry.startsWith('ОТМЕТКА'))).toEqual([]);
  });

  it('схема применяется под своей advisory-блокировкой', async () => {
    const { pool, log } = coopPool();

    await runCoopDomainSchemaMigrations(pool, mainPool(null));

    expect(log[0]).toBe('SELECT pg_advisory_lock');
    expect(log[log.length - 1]).toBe('SELECT pg_advisory_unlock');
  });
});

describe('схема базы CoopID — перечень', () => {
  const real = jest.requireActual('~/infrastructure/auth-v2/coop-domain-migrations') as {
    coopDomainDatabaseMigrations: ReadonlyArray<new () => { name?: string }>;
    COOP_DOMAIN_LEGACY_VERSIONS: Record<string, string>;
  };

  it('у каждой миграции имя с меткой времени, метки идут по возрастанию без повторов', () => {
    const stamps = real.coopDomainDatabaseMigrations.map((klass) => Number(new klass().name?.slice(-13)));
    expect(stamps.every(Number.isFinite)).toBe(true);
    expect([...stamps].sort((a, b) => a - b)).toEqual(stamps);
    expect(new Set(stamps).size).toBe(stamps.length);
  });

  it('у каждой перенесённой миграции названа её прежняя версия в учёте миграций данных', () => {
    for (const klass of real.coopDomainDatabaseMigrations) {
      const name = new klass().name as string;
      if (Number(name.slice(-13)) <= 1781000000018) expect(real.COOP_DOMAIN_LEGACY_VERSIONS[name]).toBeTruthy();
    }
  });

  // Сторож: таблицы CoopID снова в миграции данных — новый узел опять встанет без них.
  it('миграции данных coop_domain_db не трогают', () => {
    const dir = join(__dirname, '../../../migrations');
    const offenders = readdirSync(dir)
      .filter((file) => /\.(ts|js)$/.test(file))
      .filter((file) => readFileSync(join(dir, file), 'utf8').includes('coopDomainDb'));
    expect(offenders).toEqual([]);
  });
});
