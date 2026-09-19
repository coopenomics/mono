/** Возвраты по Положению ЦПП: до активации — полностью, по недобору — на паевой, отказ — половина остатка. */
import { calculateRefund, monthsOfPeriod, RefundReason } from '~/extensions/edubridge/domain/economy/refund.calculator';

const BASE = {
  paid_amount: '9600.0000 RUB',
  lessons_per_month: 8,
  lessons_total: 64,
  months_paid: 1,
  starts_at: new Date('2026-10-01T00:00:00Z'),
};

describe('Расчёт возврата подписки', () => {
  it('до активации курса возвращается полная стоимость на кошелёк программы', () => {
    const r = calculateRefund({ ...BASE, now: new Date('2026-09-20T00:00:00Z') });
    expect(r.reason).toBe(RefundReason.BEFORE_START);
    expect(r.refund).toBe('9600.0000 RUB');
    expect(r.withheld).toBe('0.0000 RUB');
    expect(r.to_share).toBe(false);
  });

  it('курс без даты активации считается неактивированным', () => {
    const r = calculateRefund({ ...BASE, starts_at: null, now: new Date('2026-12-01T00:00:00Z') });
    expect(r.reason).toBe(RefundReason.BEFORE_START);
    expect(r.refund).toBe('9600.0000 RUB');
  });

  it('отмена по недобору возвращает всё и сразу на паевой', () => {
    const r = calculateRefund({ ...BASE, now: new Date('2026-09-20T00:00:00Z'), underfilled: true });
    expect(r.reason).toBe(RefundReason.UNDERFILLED);
    expect(r.refund).toBe('9600.0000 RUB');
    expect(r.to_share).toBe(true);
  });

  it('отказ в середине месяца: половина остатка по числу проведённых занятий', () => {
    // 15 дней из 30 при восьми занятиях в месяц — четыре занятия проведено,
    // остаток половины периода делится пополам.
    const r = calculateRefund({ ...BASE, now: new Date('2026-10-16T00:00:00Z') });
    expect(r.reason).toBe(RefundReason.REFUSAL);
    expect(r.lessons_paid).toBe(8);
    expect(r.lessons_used).toBe(4);
    expect(r.refund).toBe('2400.0000 RUB');
    expect(r.withheld).toBe('7200.0000 RUB');
  });

  it('отказ в первый день после активации: половина полной стоимости', () => {
    const r = calculateRefund({ ...BASE, now: new Date('2026-10-01T06:00:00Z') });
    expect(r.lessons_used).toBe(0);
    expect(r.refund).toBe('4800.0000 RUB');
  });

  it('отказ после последнего занятия возвращает ноль', () => {
    const r = calculateRefund({ ...BASE, now: new Date('2026-11-05T00:00:00Z') });
    expect(r.lessons_used).toBe(8);
    expect(r.refund).toBe('0.0000 RUB');
    expect(r.withheld).toBe('9600.0000 RUB');
  });

  it('годовая подписка оплачивает двенадцать месяцев, но не больше программы курса', () => {
    const r = calculateRefund({
      ...BASE,
      paid_amount: '96000.0000 RUB',
      months_paid: monthsOfPeriod('year'),
      lessons_total: 64,
      now: new Date('2026-10-01T06:00:00Z'),
    });
    // Восемь занятий в месяц за год дают 96, но программа курса — 64.
    expect(r.lessons_paid).toBe(64);
    expect(r.refund).toBe('48000.0000 RUB');
  });
});
