import {
  EXPENSE_PLAN_RECURRENCE_MONTHS,
  expensePlanRecurrenceMonths,
  expensePlanReserveMonths,
  expensePlanReserveShare,
  expensePlanScheduleDates,
  nextExpensePlanDate,
} from '@coopenomics/extension-kit';

/**
 * Календарь повторяющегося планового расхода (задача 99D-34, решение владельца
 * 11.11.2026; реестр expenses.plans, случаи exp.plan.schedule.*).
 *
 * По этому календарю расширение расходов продолжает серию записей реестра, а
 * Стол заказов показывает сроки будущих платежей и считает резерв участка.
 * Проверяются края месяцев и года по UTC и совпадение сроков, которые
 * показывает экран, с цепочкой, которую заводит реестр.
 */

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

describe('Календарь планового расхода — шаг серии', () => {
  it('разовый 0, каждый месяц 1, квартал 3, год 12', () => {
    expect(expensePlanRecurrenceMonths('NONE')).toBe(0);
    expect(expensePlanRecurrenceMonths('MONTHLY')).toBe(1);
    expect(expensePlanRecurrenceMonths('QUARTERLY')).toBe(3);
    expect(expensePlanRecurrenceMonths('YEARLY')).toBe(12);
    expect(Object.keys(EXPENSE_PLAN_RECURRENCE_MONTHS).sort()).toEqual(['MONTHLY', 'NONE', 'QUARTERLY', 'YEARLY']);
  });

  it('неизвестная и пустая периодичность — разовый расход', () => {
    expect(expensePlanRecurrenceMonths('WEEKLY')).toBe(0);
    expect(expensePlanRecurrenceMonths('')).toBe(0);
    expect(expensePlanRecurrenceMonths(null)).toBe(0);
    expect(expensePlanRecurrenceMonths(undefined)).toBe(0);
  });
});

describe('Календарь планового расхода — следующий срок', () => {
  it('число месяца сохраняется: 11.11.2026 → 11.12.2026, 11.02.2027, 11.11.2027', () => {
    const from = utc(2026, 11, 11);
    expect(day(nextExpensePlanDate(from, 1))).toBe('2026-12-11');
    expect(day(nextExpensePlanDate(from, 3))).toBe('2027-02-11');
    expect(day(nextExpensePlanDate(from, 12))).toBe('2027-11-11');
  });

  it('переход через год: 15.12.2026 + месяц → 15.01.2027', () => {
    expect(day(nextExpensePlanDate(utc(2026, 12, 15), 1))).toBe('2027-01-15');
  });

  it('нет такого числа в месяце — последний день месяца, без перескока', () => {
    expect(day(nextExpensePlanDate(utc(2027, 1, 31), 1))).toBe('2027-02-28');
    expect(day(nextExpensePlanDate(utc(2028, 1, 31), 1))).toBe('2028-02-29');
    expect(day(nextExpensePlanDate(utc(2026, 11, 30), 3))).toBe('2027-02-28');
    expect(day(nextExpensePlanDate(utc(2027, 3, 31), 1))).toBe('2027-04-30');
    expect(day(nextExpensePlanDate(utc(2028, 2, 29), 12))).toBe('2029-02-28');
  });

  it('счёт по UTC: время суток сохраняется, поздний вечер не переходит в соседний день', () => {
    const late = new Date(Date.UTC(2026, 10, 30, 23, 30, 15, 250));
    expect(nextExpensePlanDate(late, 1)?.toISOString()).toBe('2026-12-30T23:30:15.250Z');
    expect(nextExpensePlanDate(utc(2026, 11, 1), 1)?.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('разовый расход и неверный шаг продолжения не имеют', () => {
    expect(nextExpensePlanDate(utc(2026, 11, 11), 0)).toBeNull();
    expect(nextExpensePlanDate(utc(2026, 11, 11), -3)).toBeNull();
    expect(nextExpensePlanDate(utc(2026, 11, 11), 1.5)).toBeNull();
  });
});

describe('Календарь планового расхода — сроки серии', () => {
  it('квартал от 11.11.2026: 11.11.2026, 11.02.2027, 11.05.2027, 11.08.2027', () => {
    expect(expensePlanScheduleDates(utc(2026, 11, 11), 3, 4).map(day)).toEqual([
      '2026-11-11',
      '2027-02-11',
      '2027-05-11',
      '2027-08-11',
    ]);
  });

  it('год от 11.11.2026: следующий платёж 11.11.2027', () => {
    expect(expensePlanScheduleDates(utc(2026, 11, 11), 12, 2).map(day)).toEqual(['2026-11-11', '2027-11-11']);
  });

  it('разовый расход — один срок при любом запрошенном числе; ноль сроков — пусто', () => {
    expect(expensePlanScheduleDates(utc(2026, 11, 11), 0, 4).map(day)).toEqual(['2026-11-11']);
    expect(expensePlanScheduleDates(utc(2026, 11, 11), 1, 0)).toEqual([]);
  });

  it('срок считается от предыдущего, как реестр продолжает серию: 31.01 → 28.02 → 28.03', () => {
    expect(expensePlanScheduleDates(utc(2027, 1, 31), 1, 3).map(day)).toEqual(['2027-01-31', '2027-02-28', '2027-03-28']);
  });

  it('на 300 случайных датах сроки — цепочка следующих сроков с шагом ровно в период', () => {
    let seed = 7;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let i = 0; i < 300; i++) {
      const first = utc(2026 + rnd(4), 1 + rnd(12), 1 + rnd(31));
      const months = [1, 3, 12][rnd(3)];
      const dates = expensePlanScheduleDates(first, months, 5);
      expect(dates).toHaveLength(5);
      for (let k = 1; k < dates.length; k++) {
        expect(dates[k]).toEqual(nextExpensePlanDate(dates[k - 1], months));
        const monthsBetween =
          (dates[k].getUTCFullYear() - dates[k - 1].getUTCFullYear()) * 12 + dates[k].getUTCMonth() - dates[k - 1].getUTCMonth();
        expect(monthsBetween).toBe(months);
      }
    }
  });
});

describe('Доля резерва под платёж', () => {
  const R = 10_000_000n; // 1 000,0000 ₽ в единицах суммы

  it('квартал: за 3 месяца до срока 0, за 2 — треть, за 1 — две трети, срок внутри покрытия — вся сумма', () => {
    expect(expensePlanReserveShare(R, 3, 3)).toBe(0n);
    expect(expensePlanReserveShare(R, 2, 3)).toBe(3_333_333n);
    expect(expensePlanReserveShare(R, 1, 3)).toBe(6_666_666n);
    expect(expensePlanReserveShare(R, 0, 3)).toBe(R);
  });

  it('просроченный платёж резерв держит целиком', () => {
    expect(expensePlanReserveShare(R, -1, 3)).toBe(R);
    expect(expensePlanReserveShare(R, -24, 12)).toBe(R);
  });

  it('год: за 11 месяцев до срока — двенадцатая часть, за 6 — половина, раньше — ничего', () => {
    expect(expensePlanReserveShare(R, 12, 12)).toBe(0n);
    expect(expensePlanReserveShare(R, 11, 12)).toBe(R / 12n);
    expect(expensePlanReserveShare(R, 6, 12)).toBe(R / 2n);
  });

  it('ежемесячный и разовый платёж собирается за один месяц, целиком', () => {
    for (const period of [0, 1]) {
      expect(expensePlanReserveShare(R, 1, period)).toBe(0n);
      expect(expensePlanReserveShare(R, 5, period)).toBe(0n);
      expect(expensePlanReserveShare(R, 0, period)).toBe(R);
    }
  });

  it('нулевая и отрицательная сумма резерва не даёт', () => {
    expect(expensePlanReserveShare(0n, 0, 3)).toBe(0n);
    expect(expensePlanReserveShare(-5n, 1, 3)).toBe(0n);
  });

  it('месяцев накопления: период повторяющегося расхода, для разового и ежемесячного — один', () => {
    expect(expensePlanReserveMonths(0)).toBe(1);
    expect(expensePlanReserveMonths(1)).toBe(1);
    expect(expensePlanReserveMonths(3)).toBe(3);
    expect(expensePlanReserveMonths(12)).toBe(12);
  });

  it('на 2000 случайных суммах: доля не убывает к сроку, шаг — n-я часть (± единица), к сроку — вся сумма', () => {
    let seed = 11;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let i = 0; i < 2000; i++) {
      const amount = BigInt(1 + rnd(2_000_000_000));
      const period = [2, 3, 6, 12][rnd(4)];
      const step = amount / BigInt(period);
      let prev = 0n;
      let collected = 0n;
      for (let ahead = period + 2; ahead >= 0; ahead--) {
        const share = expensePlanReserveShare(amount, ahead, period);
        const delta = share - prev;
        expect(delta >= 0n).toBe(true);
        if (ahead >= period) expect(share).toBe(0n);
        else expect(delta === step || delta === step + 1n).toBe(true);
        collected += delta;
        prev = share;
      }
      expect(prev).toBe(amount);
      expect(collected).toBe(amount);
    }
  });
});
