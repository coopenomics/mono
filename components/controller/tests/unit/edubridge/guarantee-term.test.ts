import { guaranteeDaySeconds, guaranteeEndsAt, guaranteeSeconds, isGuaranteeRunning } from '~/extensions/edubridge/domain/economy/guarantee';

describe('Гарантийный срок группы — длина суток', () => {
  const previous = process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS;
  afterEach(() => {
    if (previous === undefined) delete process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS;
    else process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS = previous;
  });

  it('в работе сутки — 86 400 секунд: срок в цепь уходит днями курса в секундах', () => {
    delete process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS;
    expect(guaranteeDaySeconds()).toBe(86_400);
    expect(guaranteeSeconds({ guarantee_days: 14 })).toBe(14 * 86_400);
    expect(guaranteeEndsAt({ starts_at: '2026-10-01', guarantee_days: 14 })).toEqual(new Date('2026-10-15T00:00:00Z'));
  });

  it('стенд внешних тестов задаёт короткие сутки — срок на сервере и в цепи сокращается одинаково', () => {
    process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS = '300';
    expect(guaranteeSeconds({ guarantee_days: 14 })).toBe(14 * 300);
    const course = { starts_at: '2026-10-01', guarantee_days: 14 };
    expect(guaranteeEndsAt(course)).toEqual(new Date('2026-10-01T01:10:00Z'));
    expect(isGuaranteeRunning(course, new Date('2026-10-01T01:09:00Z'))).toBe(true);
    expect(isGuaranteeRunning(course, new Date('2026-10-01T01:11:00Z'))).toBe(false);
  });

  it('пустое, нулевое и нечисловое значение переменной — обычные сутки; гарантия не объявлена — срока нет', () => {
    for (const bad of ['', '0', '-5', 'пять минут']) {
      process.env.EDUBRIDGE_GUARANTEE_DAY_SECONDS = bad;
      expect(guaranteeDaySeconds()).toBe(86_400);
    }
    expect(guaranteeSeconds({ guarantee_days: 0 })).toBe(0);
    expect(isGuaranteeRunning({ starts_at: '2026-10-01', guarantee_days: 0 }, new Date('2026-10-01T00:00:01Z'))).toBe(false);
  });
});
