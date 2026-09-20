/** Срок взноса за весь курс разом: курс заканчивается в один день для всех, пришедший в середине платит за остаток. */
import { remainingCoursePeriod } from '~/extensions/edubridge/domain/economy/course-period.calculator';

const START = new Date('2026-09-01T06:00:00Z');
const END = new Date('2027-06-01T06:00:00Z');

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
    expect(r?.paid_until.getTime()).toBe(new Date('2026-11-10T06:00:00Z').getTime());
  });

  it('в середине курса оплачиваются оставшиеся месяцы, неполный считается месяцем', () => {
    const r = remainingCoursePeriod(START, 9, new Date('2027-01-15T06:00:00Z'));
    // С 15 января до 1 июня — четыре полных месяца и половина пятого.
    expect(r?.months).toBe(5);
    expect(r?.paid_until.getTime()).toBe(END.getTime());
  });

  it('ровно на границе месяца лишний месяц не добавляется', () => {
    const r = remainingCoursePeriod(START, 9, new Date('2027-02-01T06:00:00Z'));
    expect(r?.months).toBe(4);
  });

  it('программа закончилась либо оплачена до конца — оплачивать нечего', () => {
    expect(remainingCoursePeriod(START, 9, END)).toBeNull();
    expect(remainingCoursePeriod(START, 9, new Date('2027-07-01T06:00:00Z'))).toBeNull();
  });

  it('у курса без конечной программы срока нет', () => {
    expect(remainingCoursePeriod(START, 0, START)).toBeNull();
  });
});
