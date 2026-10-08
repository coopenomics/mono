/** Предварительная сумма возврата по строке подписки из цепи — то же правило, что в контракте (`Edubridge::refusal_refund`). */
import { calculateRefund, RefundReason } from '~/extensions/edubridge/domain/economy/refund.calculator';

const START = new Date('2026-10-01T00:00:00Z');
/** Взнос 3000 за 8 занятий. */
const chain = (done: number) => ({ charged: '3000.0000 RUB', lessons_paid: 8, lessons_done: done });

describe('calculateRefund — возврат взноса при отмене подписки', () => {
  it('до начала занятий возвращается весь взнос на кошелёк членских взносов', () => {
    const r = calculateRefund({ chain: chain(0), starts_at: START, now: new Date('2026-09-20T00:00:00Z') });
    expect(r).toMatchObject({ reason: RefundReason.BEFORE_START, refund: '3000.0000 RUB', withheld: '0.0000 RUB', to_share: false });
  });

  it('курс без даты начала — занятия ещё не начались, возврат полный', () => {
    const r = calculateRefund({ chain: chain(0), starts_at: null, now: new Date('2026-12-01T00:00:00Z') });
    expect(r.reason).toBe(RefundReason.BEFORE_START);
    expect(r.refund).toBe('3000.0000 RUB');
  });

  it('недобор: взнос целиком и сразу в паевой взнос', () => {
    const r = calculateRefund({ chain: chain(0), starts_at: START, now: new Date('2026-09-20T00:00:00Z'), underfilled: true });
    expect(r).toMatchObject({ reason: RefundReason.UNDERFILLED, refund: '3000.0000 RUB', to_share: true });
  });

  it('отказ в ходе подписки: половина остаточной стоимости от полного взноса', () => {
    // Проведено 3 занятия из 8: остаточная стоимость 3000 × 5 / 8 = 1875, возврат — половина.
    const r = calculateRefund({ chain: chain(3), starts_at: START, now: new Date('2026-10-12T00:00:00Z') });
    expect(r).toMatchObject({ reason: RefundReason.REFUSAL, refund: '937.5000 RUB', withheld: '2062.5000 RUB', lessons_paid: 8, lessons_used: 3, to_share: false });
  });

  it('занятия ещё не проводились — возвращается половина взноса', () => {
    const r = calculateRefund({ chain: chain(0), starts_at: START, now: new Date('2026-10-02T00:00:00Z') });
    expect(r.refund).toBe('1500.0000 RUB');
  });

  it('все оплаченные занятия проведены — возвращать нечего', () => {
    const r = calculateRefund({ chain: chain(8), starts_at: START, now: new Date('2026-11-05T00:00:00Z') });
    expect(r.refund).toBe('0.0000 RUB');
    expect(r.withheld).toBe('3000.0000 RUB');
  });

  it('подписки в цепи нет — сумма нулевая', () => {
    const r = calculateRefund({ chain: { charged: '0.0000 RUB', lessons_paid: 0, lessons_done: 0 }, starts_at: START, now: new Date('2026-10-12T00:00:00Z') });
    expect(r.refund).toBe('0.0000 RUB');
  });
});
