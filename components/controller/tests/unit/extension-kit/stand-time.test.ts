import {
  describeStandTime,
  isStandTimeCompressed,
  isStandTimeConfigured,
  isStandWorkerTurn,
  standDaySeconds,
  standMonthSeconds,
  standPeriodKey,
  standWorkerPaceSeconds,
} from '@coopenomics/extension-kit';

/**
 * Шкала времени стенда — общая для всех приложений (решение владельца 01.11.2026).
 * В работе время настоящее при любых переменных; на стенде сутки, месяц и шаг
 * обходов задаются окружением.
 */
describe('шкала времени стенда', () => {
  const saved = { ...process.env };
  const VARS = ['NODE_ENV', 'STAND_DAY_SECONDS', 'STAND_MONTH_SECONDS', 'STAND_WORKER_PACE_SECONDS'];

  function env(values: Record<string, string | undefined>): void {
    for (const k of VARS) delete process.env[k];
    for (const [k, v] of Object.entries(values)) if (v !== undefined) process.env[k] = v;
  }

  afterEach(() => {
    for (const k of VARS) delete process.env[k];
    for (const k of VARS) if (saved[k] !== undefined) process.env[k] = saved[k];
  });

  it('в работе время настоящее, даже если переменные стоят', () => {
    env({ NODE_ENV: 'production', STAND_DAY_SECONDS: '60', STAND_MONTH_SECONDS: '300' });
    expect(standDaySeconds()).toBe(86400);
    expect(standMonthSeconds()).toBe(0);
    expect(isStandTimeCompressed()).toBe(false);
    expect(isStandTimeConfigured()).toBe(false);
  });

  it('без переменных на стенде время тоже настоящее', () => {
    env({ NODE_ENV: 'development' });
    expect(standDaySeconds()).toBe(86400);
    expect(standMonthSeconds()).toBe(0);
    expect(isStandTimeCompressed()).toBe(false);
    expect(describeStandTime()).toBe('время настоящее');
  });

  it('сутки и месяц из окружения; мусор и ноль суток не принимаются', () => {
    env({ NODE_ENV: 'development', STAND_DAY_SECONDS: '60', STAND_MONTH_SECONDS: '300' });
    expect(standDaySeconds()).toBe(60);
    expect(standMonthSeconds()).toBe(300);
    expect(isStandTimeCompressed()).toBe(true);

    env({ NODE_ENV: 'development', STAND_DAY_SECONDS: '0' });
    expect(standDaySeconds()).toBe(86400);
    env({ NODE_ENV: 'development', STAND_DAY_SECONDS: 'abc' });
    expect(standDaySeconds()).toBe(86400);
  });

  it('месяц не задан при коротких сутках — десять суток', () => {
    env({ NODE_ENV: 'development', STAND_DAY_SECONDS: '60' });
    expect(standMonthSeconds()).toBe(600);
  });

  it('расчётный период: календарный месяц в часовом поясе, при сжатом месяце — отрезок его длины', () => {
    const instant = new Date('2026-11-30T22:30:00Z');
    env({ NODE_ENV: 'development' });
    expect(standPeriodKey(instant, 'Europe/Moscow')).toBe(2026 * 12 + 12);
    expect(standPeriodKey(instant, 'UTC')).toBe(2026 * 12 + 11);

    env({ NODE_ENV: 'development', STAND_MONTH_SECONDS: '300' });
    const a = new Date(1_800_000_000_000);
    expect(standPeriodKey(new Date(a.getTime() + 299_000), 'UTC')).toBe(standPeriodKey(a, 'UTC'));
    expect(standPeriodKey(new Date(a.getTime() + 300_000), 'UTC')).toBe(standPeriodKey(a, 'UTC') + 1);
  });

  it('шаг обходов: в работе свой, при сжатом времени — шаг стенда', () => {
    env({ NODE_ENV: 'development' });
    expect(standWorkerPaceSeconds(3600)).toBe(3600);
    expect(isStandWorkerTurn(3600, new Date('2026-11-01T10:00:00Z'))).toBe(true);
    expect(isStandWorkerTurn(3600, new Date('2026-11-01T10:01:00Z'))).toBe(false);

    env({ NODE_ENV: 'development', STAND_DAY_SECONDS: '60' });
    expect(standWorkerPaceSeconds(3600)).toBe(60);
    expect(isStandWorkerTurn(3600, new Date('2026-11-01T10:01:00Z'))).toBe(true);

    env({ NODE_ENV: 'development', STAND_DAY_SECONDS: '60', STAND_WORKER_PACE_SECONDS: '120' });
    expect(standWorkerPaceSeconds(3600)).toBe(120);
  });
});
