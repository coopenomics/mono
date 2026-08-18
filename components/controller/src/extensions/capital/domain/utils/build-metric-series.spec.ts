import {
  buildMetricSeries,
  defaultSeriesFrom,
  METRIC_SERIES_LOOKBACK_DAYS,
} from './build-metric-series';

describe('buildMetricSeries (дневной ряд)', () => {
  it('агрегирует delta по дням и считает cumulative', () => {
    const points = buildMetricSeries(
      [
        { delta: 2, occurred_at: new Date('2026-07-01T10:00:00Z') },
        { delta: 3, occurred_at: new Date('2026-07-01T18:00:00Z') },
        { delta: -1, occurred_at: new Date('2026-07-03T12:00:00Z') },
      ],
      {
        from: new Date('2026-07-01T00:00:00Z'),
        // period_end 3-го дня — включаем 1–3 июля, без пустого 4-го
        to: new Date('2026-07-04T00:00:00Z'),
        target_value: 10,
      }
    );

    expect(points).toHaveLength(3);
    expect(points[0].delta).toBe(5);
    expect(points[0].cumulative).toBe(5);
    expect(points[1].delta).toBe(0);
    expect(points[1].cumulative).toBe(5);
    expect(points[2].delta).toBe(-1);
    expect(points[2].cumulative).toBe(4);
    expect(points[0].ideal_cumulative).toBeNull();
  });

  it('на границе суток не добавляет пустой следующий день', () => {
    const points = buildMetricSeries(
      [{ delta: 6, occurred_at: new Date('2026-07-28T19:00:00Z') }],
      {
        from: new Date('2026-07-27T00:00:00Z'),
        // кадр истории = period_end дня 28-го
        to: new Date('2026-07-29T00:00:00Z'),
        target_value: 10,
      }
    );

    expect(points).toHaveLength(2);
    expect(points[0].delta).toBe(0);
    expect(points[1].delta).toBe(6);
    expect(points[1].period_start.toISOString()).toBe('2026-07-28T00:00:00.000Z');
  });

  it('незавершённые сутки попадают в ряд последним баром', () => {
    const points = buildMetricSeries(
      [{ delta: 4, occurred_at: new Date('2026-07-28T19:00:00Z') }],
      {
        from: new Date('2026-07-28T00:00:00Z'),
        to: new Date('2026-07-28T19:05:00Z'),
        target_value: 10,
      }
    );

    expect(points).toHaveLength(1);
    expect(points[0].delta).toBe(4);
    expect(points[0].period_end.toISOString()).toBe('2026-07-29T00:00:00.000Z');
  });

  it('учитывает вклады до окна в стартовом cumulative', () => {
    const points = buildMetricSeries(
      [
        { delta: 10, occurred_at: new Date('2026-06-01T00:00:00Z') },
        { delta: 2, occurred_at: new Date('2026-07-10T12:00:00Z') },
      ],
      {
        from: new Date('2026-07-10T00:00:00Z'),
        to: new Date('2026-07-11T00:00:00Z'),
        target_value: 20,
      }
    );

    expect(points).toHaveLength(1);
    expect(points[0].delta).toBe(2);
    expect(points[0].cumulative).toBe(12);
  });

  it('строит идеальную линию от plan_start к deadline', () => {
    const points = buildMetricSeries([], {
      from: new Date('2026-07-01T00:00:00Z'),
      to: new Date('2026-07-04T00:00:00Z'),
      target_value: 100,
      plan_start: new Date('2026-07-01T00:00:00Z'),
      deadline: new Date('2026-07-05T00:00:00Z'),
    });

    // period_end day1 = Jul 2 → 25%; day2=Jul3 → 50%; day3=Jul4 → 75%
    expect(points).toHaveLength(3);
    expect(points[0].ideal_cumulative).toBe(25);
    expect(points[1].ideal_cumulative).toBe(50);
    expect(points[2].ideal_cumulative).toBe(75);
  });

  it('окно по умолчанию — 30 дневных баров', () => {
    const to = new Date('2026-07-28T19:05:00Z');
    const points = buildMetricSeries([], {
      from: defaultSeriesFrom(to),
      to,
      target_value: 0,
    });

    expect(METRIC_SERIES_LOOKBACK_DAYS).toBe(29);
    expect(points).toHaveLength(30);
    expect(points[points.length - 1].period_start.toISOString()).toBe(
      '2026-07-28T00:00:00.000Z'
    );
  });
});
