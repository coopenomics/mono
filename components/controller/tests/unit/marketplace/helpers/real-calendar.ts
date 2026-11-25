/**
 * Тест идёт по настоящему календарю. Шкала стенда (сжатые сутки и месяц)
 * читается из окружения при каждом вызове, а локальный `.env` стенда
 * разработки её задаёт — на время набора переменные убираются и
 * возвращаются после него.
 */
const STAND_SCALE = ['STAND_DAY_SECONDS', 'STAND_MONTH_SECONDS', 'STAND_WORKER_PACE_SECONDS'] as const;

export function useRealCalendar(): void {
  const before = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const name of STAND_SCALE) {
      before.set(name, process.env[name]);
      delete process.env[name];
    }
  });

  afterAll(() => {
    for (const [name, value] of before) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}
