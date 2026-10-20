/**
 * Новый узел проводит миграции при первом старте сам. Тестнет, 20.10.2026:
 * новый узел вставал без миграций данных, реестр шаблонов документов был пуст,
 * и бланк не собирался («Шаблон 1 не найден»).
 */
const calls: string[] = [];
const migrateData = jest.fn(async () => {
  calls.push('migrateData');
});
jest.mock('~/migrator/migrate', () => ({ migrateData: () => migrateData() }));
const config = { auto_migrate: false };
jest.mock('~/config/config', () => ({ __esModule: true, default: config }));

/** Учёт миграций данных: null — таблицы нет. */
let ledger: Array<{ version: string; success: boolean }> | null = null;
const fakePool = {
  query: jest.fn(async (sql: string, parameters: unknown[] = []) => {
    if (sql.includes('to_regclass')) return { rows: [{ exists: ledger !== null }] };
    if (sql.startsWith('SELECT version, success')) return { rows: ledger ?? [] };
    if (sql.startsWith('UPDATE')) {
      const row = (ledger ?? []).find((item) => item.version === parameters[0]);
      if (row) {
        row.success = parameters[1] as boolean;
        calls.push(`отметка ${String(row.success)}`);
      }
      return { rowCount: row ? 1 : 0, rows: [] };
    }
    if (sql.startsWith('INSERT')) {
      ledger?.push({ version: parameters[0] as string, success: parameters[2] as boolean });
      calls.push(`отметка ${String(parameters[2])}`);
      return { rowCount: 1, rows: [] };
    }
    return { rows: [] };
  }),
  end: jest.fn(async () => undefined),
};
jest.mock('~/infrastructure/database/postgres/postgres-connection', () => ({ createMainPool: () => fakePool }));

import {
  FIRST_START_MARK,
  nodeNeedsFirstStartMigrations,
  runStartupMigrations,
} from '~/migrator/fresh-node-migrations';

beforeEach(() => {
  calls.length = 0;
  migrateData.mockClear();
  config.auto_migrate = false;
});

describe('признак нового узла', () => {
  it('учёта миграций данных нет — узел новый', async () => {
    ledger = null;
    await expect(nodeNeedsFirstStartMigrations()).resolves.toBe(true);
  });

  it('учёт есть, но пуст — узел новый', async () => {
    ledger = [];
    await expect(nodeNeedsFirstStartMigrations()).resolves.toBe(true);
  });

  // Живой узел: рестарт миграции не запускает, их раскатывает выпуск.
  it('в учёте есть записи без отметки первого старта — узел живой', async () => {
    ledger = [{ version: '2.5.0', success: true }];
    await expect(nodeNeedsFirstStartMigrations()).resolves.toBe(false);
  });

  // Первый старт упал посреди миграций: записи есть, но работа не закончена.
  it('отметка первого старта без успеха — узлу снова нужны миграции', async () => {
    ledger = [
      { version: FIRST_START_MARK, success: false },
      { version: '2.3.3', success: true },
    ];
    await expect(nodeNeedsFirstStartMigrations()).resolves.toBe(true);
  });

  it('отметка первого старта с успехом — узел живой', async () => {
    ledger = [
      { version: FIRST_START_MARK, success: true },
      { version: '2.3.3', success: true },
    ];
    await expect(nodeNeedsFirstStartMigrations()).resolves.toBe(false);
  });
});

describe('миграции при старте', () => {
  it('новый узел: отметка «начат» → все миграции → отметка «завершён»', async () => {
    ledger = [];
    await runStartupMigrations();
    expect(calls).toEqual(['отметка false', 'migrateData', 'отметка true']);
  });

  it('живой узел: при рестарте ничего не проводится', async () => {
    ledger = [{ version: '2.5.0', success: true }];
    await runStartupMigrations();
    expect(migrateData).not.toHaveBeenCalled();
  });

  it('стенд (AUTO_MIGRATE): миграции всегда, отметка первого старта не ставится', async () => {
    config.auto_migrate = true;
    ledger = [{ version: '2.5.0', success: true }];
    await runStartupMigrations();
    expect(calls).toEqual(['migrateData']);
  });

  it('миграции упали — процесс завершается, отметка остаётся незавершённой', async () => {
    ledger = [];
    migrateData.mockRejectedValueOnce(new Error('сбой'));
    const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    await runStartupMigrations();
    expect(exit).toHaveBeenCalledWith(1);
    expect(ledger).toEqual([{ version: FIRST_START_MARK, success: false }]);
    exit.mockRestore();
  });
});
