/** Резерв выплат преподавателям считается от обязательств по курсу, а не от числа учеников. */
import { reserveTarget } from '~/extensions/edubridge/domain/economy/teacher-reserve.calculator';

const DAY = 86400_000;
const start = new Date('2026-09-01T00:00:00Z');
const month = (n: number) => new Date(start.getTime() + n * 30 * DAY);
const course = { cost_month: '800.0000 RUB', course_months: 0, starts_at: start };
const empty = { balance: '0.0000 RUB', settled: '0.0000 RUB' };

describe('reserveTarget', () => {
  it('один ученик оплатил месяц — резерв должен покрыть месяц часов преподавателя', () => {
    const t = reserveTarget(course, [{ from: start, until: month(1) }], empty);
    expect(t).toEqual({ obligation: '800.0000 RUB', gap: '800.0000 RUB', surplus: '0.0000 RUB' });
  });

  it('пять учеников на том же месяце — обязательство то же: занятие одно на всех', () => {
    const five = Array.from({ length: 5 }, () => ({ from: start, until: month(1) }));
    expect(reserveTarget(course, five, empty).obligation).toBe('800.0000 RUB');
  });

  it('бюджет преподавателя закрыт первым взносом — остальным добирать нечего', () => {
    const t = reserveTarget(course, [{ from: start, until: month(1) }, { from: start, until: month(1) }], { balance: '800.0000 RUB', settled: '0.0000 RUB' });
    expect(t.gap).toBe('0.0000 RUB');
    expect(t.surplus).toBe('0.0000 RUB');
  });

  it('оплаченное время — самый ранний и самый поздний день среди учеников', () => {
    const t = reserveTarget(course, [{ from: start, until: month(1) }, { from: month(1), until: month(3) }], empty);
    expect(t.obligation).toBe('2400.0000 RUB');
  });

  it('выплаченное преподавателям уменьшает обязательство', () => {
    const t = reserveTarget(course, [{ from: start, until: month(2) }], { balance: '1000.0000 RUB', settled: '600.0000 RUB' });
    expect(t).toEqual({ obligation: '1000.0000 RUB', gap: '0.0000 RUB', surplus: '0.0000 RUB' });
  });

  it('ученик ушёл — оплаченное время сократилось, лишний резерв возвращается в фонд', () => {
    const t = reserveTarget(course, [{ from: start, until: month(1) }], { balance: '1600.0000 RUB', settled: '0.0000 RUB' });
    expect(t.surplus).toBe('800.0000 RUB');
    expect(t.gap).toBe('0.0000 RUB');
  });

  it('курс с конечной программой: обязательство не больше стоимости всей программы', () => {
    const finite = { ...course, course_months: 2 };
    expect(reserveTarget(finite, [{ from: start, until: month(8) }], empty).obligation).toBe('1600.0000 RUB');
  });

  it('оплата до начала занятий считается от начала занятий', () => {
    const early = new Date(start.getTime() - 20 * DAY);
    expect(reserveTarget(course, [{ from: early, until: month(1) }], empty).obligation).toBe('800.0000 RUB');
  });

  it('никто не оплатил либо выплачено больше оплаченного — обязательства нет', () => {
    expect(reserveTarget(course, [], empty).obligation).toBe('0.0000 RUB');
    expect(reserveTarget(course, [{ from: start, until: month(1) }], { balance: '0.0000 RUB', settled: '900.0000 RUB' }).obligation).toBe('0.0000 RUB');
  });
});
