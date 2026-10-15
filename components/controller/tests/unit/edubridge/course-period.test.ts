/** Срок взноса за весь курс разом: курс заканчивается в один день для всех, пришедший в середине платит за остаток. */
import { monthPeriod, remainingCoursePeriod } from '~/extensions/edubridge/domain/economy/course-period.calculator';

const START = new Date('2026-09-01T06:00:00Z');
/** Месяц — четыре недели: девять месяцев программы — 252 дня. */
const END = new Date('2027-05-11T06:00:00Z');

describe('Срок взноса за весь курс', () => {
  it('до начала занятий оплачивается весь курс, срок — от дня начала', () => {
    const r = remainingCoursePeriod(START, 9, new Date('2026-08-10T06:00:00Z'));
    expect(r?.months).toBe(9);
    expect(r?.paid_until.getTime()).toBe(END.getTime());
  });

  it('день начала не назначен — курс отсчитывается от дня взноса', () => {
    const from = new Date('2026-08-10T06:00:00Z');
    const r = remainingCoursePeriod(null, 3, from);
    expect(r?.months).toBe(3);
    expect(r?.paid_until.getTime()).toBe(new Date('2026-11-02T06:00:00Z').getTime());
  });

  it('в середине курса оплачиваются оставшиеся месяцы, неполный считается месяцем', () => {
    const r = remainingCoursePeriod(START, 9, new Date('2027-01-15T06:00:00Z'));
    // С 15 января до 11.05 — четыре полных месяца по четыре недели и часть пятого.
    expect(r?.months).toBe(5);
    expect(r?.paid_until.getTime()).toBe(END.getTime());
  });

  it('ровно на границе месяца лишний месяц не добавляется', () => {
    const r = remainingCoursePeriod(START, 9, new Date('2027-01-19T06:00:00Z'));
    expect(r?.months).toBe(4);
  });

  it('программа закончилась либо оплачена до конца — оплачивать нечего', () => {
    expect(remainingCoursePeriod(START, 9, END)).toBeNull();
    expect(remainingCoursePeriod(START, 9, new Date('2027-07-01T06:00:00Z'))).toBeNull();
  });

  it('программа в три месяца и две недели заканчивается через 98 дней; с начала оплачиваются четыре срока, последний неполный', () => {
    const end = new Date(START.getTime() + 98 * 86400_000);
    const r = remainingCoursePeriod(START, 3.5, START);
    expect(r?.months).toBe(4);
    expect(r?.paid_until.getTime()).toBe(end.getTime());
    // Четвёртый месяц обрезан концом программы — неполный.
    const last = monthPeriod(START, 3.5, new Date(START.getTime() + 84 * 86400_000));
    expect(last).toMatchObject({ partial: true });
    expect(last?.paid_until.getTime()).toBe(end.getTime());
    expect(monthPeriod(START, 3.5, end)).toBeNull();
  });

  it('у курса без конечной программы срока нет', () => {
    expect(remainingCoursePeriod(START, 0, START)).toBeNull();
  });
});

describe('Срок помесячного взноса', () => {
  it('запись до начала занятий: месяц идёт от дня начала, а не от дня взноса', () => {
    const r = monthPeriod(START, 9, new Date('2026-08-10T06:00:00Z'));
    expect(r?.paid_until.getTime()).toBe(new Date('2026-09-29T06:00:00Z').getTime());
  });

  it('после начала месяц идёт от дня взноса либо от конца оплаченного срока', () => {
    const r = monthPeriod(START, 9, new Date('2026-11-15T06:00:00Z'));
    expect(r?.paid_until.getTime()).toBe(new Date('2026-12-13T06:00:00Z').getTime());
  });

  it('программа в один месяц, оплаченная заранее, оплачена до своего конца; последний месяц за конец программы не выходит', () => {
    expect(monthPeriod(START, 1, new Date('2026-08-25T06:00:00Z'))?.paid_until.getTime()).toBe(new Date('2026-09-29T06:00:00Z').getTime());
    expect(monthPeriod(START, 9, new Date('2027-05-01T06:00:00Z'))?.paid_until.getTime()).toBe(END.getTime());
  });

  it('программа оплачена до конца либо закончилась — оплачивать нечего', () => {
    expect(monthPeriod(START, 9, END)).toBeNull();
    expect(monthPeriod(START, 1, new Date('2026-09-29T06:00:00Z'))).toBeNull();
  });

  it('начало не назначено либо программа без конца — месяц без ограничения', () => {
    const from = new Date('2026-08-10T06:00:00Z');
    expect(monthPeriod(null, 9, from)?.paid_until.getTime()).toBe(new Date('2026-09-07T06:00:00Z').getTime());
    expect(monthPeriod(START, 0, new Date('2030-01-10T06:00:00Z'))?.paid_until.getTime()).toBe(new Date('2030-02-07T06:00:00Z').getTime());
  });
});
