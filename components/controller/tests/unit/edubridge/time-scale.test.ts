import { addMonths } from '~/extensions/edubridge/domain/economy/course-period.calculator';
import { eduDaySeconds, eduMonthSeconds, isTimeCompressed, isWorkerTurn, workerPaceSeconds } from '~/extensions/edubridge/domain/economy/time-scale';

describe('Шкала времени образования — сжатое время стенда разработки', () => {
  const saved = { mode: process.env.NODE_ENV, day: process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS, month: process.env.EDUBRIDGE_MONTH_SECONDS };
  const put = (key: string, value: string | undefined) => (value === undefined ? delete process.env[key] : (process.env[key] = value));
  const mode = (value: string) => ((process.env as Record<string, string | undefined>).NODE_ENV = value);
  beforeEach(() => {
    put('EDUBRIDGE_GUARANTEE_DAY_SECONDS', undefined);
    put('EDUBRIDGE_MONTH_SECONDS', undefined);
  });
  afterEach(() => {
    put('NODE_ENV', saved.mode);
    put('EDUBRIDGE_GUARANTEE_DAY_SECONDS', saved.day);
    put('EDUBRIDGE_MONTH_SECONDS', saved.month);
  });

  it('в работе сжатия нет никогда: сутки и месяцы настоящие, переменные не действуют, очереди — раз в десять минут', () => {
    mode('production');
    put('EDUBRIDGE_GUARANTEE_DAY_SECONDS', '60');
    put('EDUBRIDGE_MONTH_SECONDS', '1800');
    expect(eduDaySeconds()).toBe(86_400);
    expect(eduMonthSeconds()).toBe(0);
    expect(isTimeCompressed()).toBe(false);
    expect(workerPaceSeconds()).toBe(600);
    // Месяц календарный: 31 января + месяц — последний день февраля.
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 1)).toEqual(new Date('2026-02-28T00:00:00Z'));
  });

  it('на стенде разработки сутки — минута, месяц — десять минут, очереди — каждую минуту', () => {
    mode('development');
    expect(eduDaySeconds()).toBe(60);
    expect(eduMonthSeconds()).toBe(600);
    expect(isTimeCompressed()).toBe(true);
    expect(workerPaceSeconds()).toBe(60);
    expect(addMonths(new Date('2026-10-11T10:00:00Z'), 2)).toEqual(new Date('2026-10-11T10:20:00Z'));
    expect(isWorkerTurn(new Date('2026-10-11T10:07:00Z'))).toBe(true);
  });

  it('длина месяца задаётся переменной: ноль возвращает календарные месяцы и обычный темп очередей', () => {
    mode('development');
    put('EDUBRIDGE_MONTH_SECONDS', '0');
    expect(eduMonthSeconds()).toBe(0);
    expect(isTimeCompressed()).toBe(false);
    expect(isWorkerTurn(new Date('2026-10-11T10:07:00Z'))).toBe(false);
    expect(isWorkerTurn(new Date('2026-10-11T10:10:00Z'))).toBe(true);
    put('EDUBRIDGE_MONTH_SECONDS', '900');
    expect(eduMonthSeconds()).toBe(900);
  });

  it('настоящие сутки на стенде разработки месяц не сжимают; вне стенда разработки сжатия нет', () => {
    mode('development');
    put('EDUBRIDGE_GUARANTEE_DAY_SECONDS', '86400');
    expect(eduMonthSeconds()).toBe(0);
    mode('test');
    put('EDUBRIDGE_GUARANTEE_DAY_SECONDS', undefined);
    expect(eduDaySeconds()).toBe(86_400);
    expect(isTimeCompressed()).toBe(false);
  });
});
