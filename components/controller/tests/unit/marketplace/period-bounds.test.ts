/**
 * Границы расчётного месяца по его номеру (задача 99D-22): по часовому поясу
 * кооператива, с переходом через год; на стенде со сжатым временем — отрезки
 * шкалы стенда. Реестр: mkt.order.keu.08.
 */
import { PERIOD_TIME_ZONE, periodBounds, periodKeyOf } from '~/extensions/marketplace/application/shared/period-bounds';

describe('periodBounds — месяц в часовом поясе кооператива', () => {
  const TZ = 'Europe/Moscow';

  it('ноябрь 2026 по Москве: с 31 октября 21:00 UTC до 30 ноября 21:00 UTC', () => {
    const key = 2026 * 12 + 11;
    const { start, end } = periodBounds(key, TZ);
    expect(start.toISOString()).toBe('2026-10-31T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-30T21:00:00.000Z');
  });

  it('расчётный месяц узла — по UTC, как у контракта: ноябрь 2026 с 1 ноября 00:00 UTC до 1 декабря 00:00 UTC', () => {
    // Решение владельца 11.11.2026: контракт ведёт периоды по UTC, узел считает месяц так же.
    expect(PERIOD_TIME_ZONE).toBe('UTC');
    const key = 2026 * 12 + 11;
    const { start, end } = periodBounds(key, PERIOD_TIME_ZONE);
    expect(start.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    // 31 октября 22:00 UTC — в Москве уже ноябрь, но расчётный месяц — октябрь, как в счётчике цепи.
    expect(periodKeyOf(new Date('2026-10-31T22:00:00.000Z'), PERIOD_TIME_ZONE)).toBe(key - 1);
  });

  it('декабрь переходит в январь следующего года', () => {
    const { start, end } = periodBounds(2026 * 12 + 12, TZ);
    expect(start.toISOString()).toBe('2026-11-30T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-12-31T21:00:00.000Z');
  });

  it('номер месяца момента совпадает с ключом строк учёта: 1 ноября 00:30 по Москве — ноябрь, по UTC — октябрь', () => {
    const instant = new Date('2026-10-31T21:30:00.000Z');
    expect(periodKeyOf(instant, TZ)).toBe(2026 * 12 + 11);
    expect(periodKeyOf(instant, 'UTC')).toBe(2026 * 12 + 10);
  });

  it('границы согласованы с ключом: начало месяца — внутри него, секунда до начала — в прошлом', () => {
    const key = 2026 * 12 + 11;
    const { start } = periodBounds(key, TZ);
    expect(periodKeyOf(start, TZ)).toBe(key);
    expect(periodKeyOf(new Date(start.getTime() - 1000), TZ)).toBe(key - 1);
  });

  it('пояс без летнего времени и пояс с переходом дают разные начала одного месяца', () => {
    const moscow = periodBounds(2026 * 12 + 4, 'Europe/Moscow').start.toISOString();
    const berlin = periodBounds(2026 * 12 + 4, 'Europe/Berlin').start.toISOString();
    expect(moscow).toBe('2026-03-31T21:00:00.000Z');
    expect(berlin).toBe('2026-03-31T22:00:00.000Z');
  });
});
