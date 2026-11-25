import type { InnerExpensePlan } from '@coopenomics/innercoop';
import { nextExpensePlanDate } from '@coopenomics/extension-kit';
import { plannedTargetUnits } from '~/extensions/marketplace/application/shared/planned-target.util';

/**
 * Цель плановых расходов участка (задача 99D-34, решения владельца 10.11.2026
 * и 11.11.2026; реестр marketplace.order, случаи mkt.order.keu.26–30).
 *
 * Итог месяца собирает резерв под записи реестра планов. Разовый и
 * ежемесячный платёж итог собирает целиком за месяц до срока, квартальный и
 * годовой — равными долями за три и двенадцать месяцев. Здесь проверяется,
 * что к сроку каждого платежа серии резерв держит всю сумму, а доля за месяц
 * не больше трети или двенадцатой части платежа.
 */

const BR = 'branch1';
const toUnits = (asset: string) => BigInt(Math.round(parseFloat(asset) * 10_000));
const rub = (n: number) => `${n.toFixed(4)} RUB`;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
/** Номер месяца по UTC, как у узла без сжатого времени. */
const monthKey = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth() + 1;
/** Начало месяца после месяца `y`-`m`: конец покрытия цели. */
const endOf = (y: number, m: number) => utc(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1);

let nextId = 1;
function plan(over: Partial<InnerExpensePlan>): InnerExpensePlan {
  return {
    id: nextId++,
    branchName: BR,
    title: 'Расход',
    amount: rub(1000),
    dueDate: utc(2026, 11, 11),
    proposalHash: null,
    paidAt: null,
    ...over,
  };
}

const target = (plans: InnerExpensePlan[], until: Date) => plannedTargetUnits(plans, BR, until, toUnits, monthKey);

describe('plannedTargetUnits — какие записи входят в цель', () => {
  it('срок раньше конца покрытия и просроченный — вся сумма; срок позже у разового — ничего', () => {
    const plans = [
      plan({ amount: rub(100), dueDate: utc(2026, 9, 1) }),
      plan({ amount: rub(200), dueDate: utc(2026, 11, 30) }),
      plan({ amount: rub(400), dueDate: utc(2026, 12, 1) }),
    ];
    expect(target(plans, endOf(2026, 11))).toBe(toUnits(rub(300)));
  });

  it('чужой участок, запущенная оплата, оплаченная запись и запись без срока в цель не входят', () => {
    const plans = [
      plan({ branchName: 'other' }),
      plan({ proposalHash: 'abc' }),
      plan({ paidAt: utc(2026, 11, 1) }),
      plan({ dueDate: null }),
      plan({ amount: rub(50) }),
    ];
    expect(target(plans, endOf(2026, 11))).toBe(toUnits(rub(50)));
  });

  it('срок ровно в начале следующего месяца — уже за пределами покрытия', () => {
    expect(target([plan({ dueDate: endOf(2026, 11) })], endOf(2026, 11))).toBe(0n);
  });

  it('ежемесячный платёж следующего месяца итог не собирает заранее', () => {
    expect(target([plan({ dueDate: utc(2027, 1, 11), recurrenceMonths: 1 })], endOf(2026, 12))).toBe(0n);
  });

  it('запись без шага серии (старый адаптер) считается разовой', () => {
    const p = plan({ dueDate: utc(2027, 2, 11) });
    delete p.recurrenceMonths;
    expect(target([p], endOf(2026, 12))).toBe(0n);
    expect(target([p], endOf(2027, 1))).toBe(0n);
    expect(target([p], endOf(2027, 2))).toBe(toUnits(rub(1000)));
  });
});

describe('plannedTargetUnits — доля повторяющегося платежа', () => {
  // `endOf(y, m)` — покрытие цели до конца месяца m: так считает итог месяца m − 1.
  it('квартал со сроком 11.02.2027: покрытие до ноября — 0, до декабря — треть, до января — две трети, до февраля — вся сумма', () => {
    const p = plan({ amount: rub(1000), dueDate: utc(2027, 2, 11), recurrenceMonths: 3 });
    expect(target([p], endOf(2026, 11))).toBe(0n);
    expect(target([p], endOf(2026, 12))).toBe(3_333_333n);
    expect(target([p], endOf(2027, 1))).toBe(6_666_666n);
    expect(target([p], endOf(2027, 2))).toBe(10_000_000n);
    expect(target([p], endOf(2027, 3))).toBe(10_000_000n);
  });

  it('год со сроком 11.11.2027: покрытие до ноября 2026 — 0, до декабря — 1/12, до января — 2/12, до ноября 2027 — вся сумма', () => {
    const p = plan({ amount: rub(12_000), dueDate: utc(2027, 11, 11), recurrenceMonths: 12 });
    expect(target([p], endOf(2026, 11))).toBe(0n);
    expect(target([p], endOf(2026, 12))).toBe(toUnits(rub(1_000)));
    expect(target([p], endOf(2027, 1))).toBe(toUnits(rub(2_000)));
    expect(target([p], endOf(2027, 10))).toBe(toUnits(rub(11_000)));
    expect(target([p], endOf(2027, 11))).toBe(toUnits(rub(12_000)));
  });

  it('просроченный неоплаченный экземпляр и доля следующего складываются', () => {
    const overdue = plan({ amount: rub(1000), dueDate: utc(2026, 11, 11), recurrenceMonths: 3 });
    const next = plan({ amount: rub(1000), dueDate: utc(2027, 2, 11), recurrenceMonths: 3 });
    expect(target([overdue, next], endOf(2026, 12))).toBe(10_000_000n + 3_333_333n);
  });

  it('месяц узла задаёт функция периода: на сжатом времени доля копится по месяцам стенда', () => {
    const month = 600_000; // мс в месяце стенда
    const periodOf = (d: Date) => Math.floor(d.getTime() / month);
    const p = plan({ amount: rub(300), dueDate: new Date(10 * month + 5), recurrenceMonths: 3 });
    const until = (period: number) => new Date((period + 1) * month);
    expect(plannedTargetUnits([p], BR, until(7), toUnits, periodOf)).toBe(0n);
    expect(plannedTargetUnits([p], BR, until(8), toUnits, periodOf)).toBe(toUnits(rub(100)));
    expect(plannedTargetUnits([p], BR, until(9), toUnits, periodOf)).toBe(toUnits(rub(200)));
    expect(plannedTargetUnits([p], BR, until(10), toUnits, periodOf)).toBe(toUnits(rub(300)));
  });
});

describe('plannedTargetUnits — серия за два года, как её ведёт реестр', () => {
  /**
   * Реестр заводит следующий экземпляр, когда срок текущего наступил; итог
   * месяца в начале каждого месяца считает цель до конца следующего месяца;
   * экземпляр оплачивается в день срока. Проверка: к сроку каждого платежа
   * резерв держит всю сумму, прирост цели за итог не больше доли платежа.
   */
  function runSeries(months: number, amount: number, firstDue: Date): void {
    const rows: InnerExpensePlan[] = [plan({ amount: rub(amount), dueDate: firstDue, recurrenceMonths: months })];
    const units = toUnits(rub(amount));
    const share = units / BigInt(months);
    let previous: bigint | null = null;
    for (let k = 0; k < 24; k++) {
      const closeAt = new Date(Date.UTC(2026, 10 + k, 1));
      const y = closeAt.getUTCFullYear();
      const m = closeAt.getUTCMonth() + 1;
      // Реестр продолжает серию: срок последнего экземпляра наступил — новый экземпляр.
      const last = rows[rows.length - 1];
      if (last.dueDate && last.dueDate <= closeAt) {
        rows.push(plan({ amount: rub(amount), dueDate: nextExpensePlanDate(last.dueDate, months), recurrenceMonths: months }));
      }
      // Оплата в день срока: экземпляры со сроком до начала месяца оплачены.
      for (const r of rows) if (r.dueDate && r.dueDate < closeAt && !r.paidAt) r.paidAt = r.dueDate;
      const until = endOf(y, m);
      const value = target(rows, until);
      for (const r of rows) {
        if (!r.paidAt && r.dueDate && r.dueDate < until) expect(value).toBeGreaterThanOrEqual(units);
      }
      if (previous !== null && value > previous) expect(value - previous).toBeLessThanOrEqual(months > 1 ? share + 1n : units);
      expect(value).toBeLessThanOrEqual(units);
      previous = value;
    }
  }

  it('квартальный платёж 1 000 ₽ с 11.11.2026', () => runSeries(3, 1000, utc(2026, 11, 11)));
  it('годовой платёж 12 000 ₽ с 11.11.2026', () => runSeries(12, 12_000, utc(2026, 11, 11)));
  it('ежемесячный платёж 500 ₽ с 31.01.2027 (конец месяца)', () => runSeries(1, 500, utc(2027, 1, 31)));
});
