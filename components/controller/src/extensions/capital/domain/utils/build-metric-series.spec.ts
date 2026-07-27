import { buildMetricSeries } from './build-metric-series';
import { MetricSeriesPeriod } from '../enums/metric-series-period.enum';

describe('buildMetricSeries (562-34 stage 2)', () => {
  it('агрегирует delta по дням и считает cumulative', () => {
    const points = buildMetricSeries(
      [
        { delta: 2, occurred_at: new Date('2026-07-01T10:00:00Z') },
        { delta: 3, occurred_at: new Date('2026-07-01T18:00:00Z') },
        { delta: -1, occurred_at: new Date('2026-07-03T12:00:00Z') },
      ],
      {
        period: MetricSeriesPeriod.DAY,
        from: new Date('2026-07-01T00:00:00Z'),
        to: new Date('2026-07-03T00:00:00Z'),
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

  it('учитывает вклады до окна в стартовом cumulative', () => {
    const points = buildMetricSeries(
      [
        { delta: 10, occurred_at: new Date('2026-06-01T00:00:00Z') },
        { delta: 2, occurred_at: new Date('2026-07-10T00:00:00Z') },
      ],
      {
        period: MetricSeriesPeriod.WEEK,
        from: new Date('2026-07-06T00:00:00Z'), // Monday
        to: new Date('2026-07-06T00:00:00Z'),
        target_value: 20,
      }
    );

    expect(points).toHaveLength(1);
    expect(points[0].delta).toBe(2);
    expect(points[0].cumulative).toBe(12);
  });

  it('строит идеальную линию от plan_start к deadline', () => {
    const points = buildMetricSeries([], {
      period: MetricSeriesPeriod.DAY,
      from: new Date('2026-07-01T00:00:00Z'),
      to: new Date('2026-07-03T00:00:00Z'),
      target_value: 100,
      plan_start: new Date('2026-07-01T00:00:00Z'),
      deadline: new Date('2026-07-05T00:00:00Z'),
    });

    // period_end day1 = Jul 2 → 25%; day2=Jul3 → 50%; day3=Jul4 → 75%
    expect(points[0].ideal_cumulative).toBe(25);
    expect(points[1].ideal_cumulative).toBe(50);
    expect(points[2].ideal_cumulative).toBe(75);
  });

  it('агрегирует по минутам', () => {
    const points = buildMetricSeries(
      [
        { delta: 1, occurred_at: new Date('2026-07-27T12:01:10Z') },
        { delta: 2, occurred_at: new Date('2026-07-27T12:01:50Z') },
        { delta: 4, occurred_at: new Date('2026-07-27T12:02:00Z') },
      ],
      {
        period: MetricSeriesPeriod.MINUTE,
        from: new Date('2026-07-27T12:01:00Z'),
        to: new Date('2026-07-27T12:02:00Z'),
        target_value: 10,
      }
    );

    expect(points).toHaveLength(2);
    expect(points[0].delta).toBe(3);
    expect(points[1].delta).toBe(4);
    expect(points[1].cumulative).toBe(7);
  });

  it('агрегирует по 5-минутным бакетам', () => {
    const points = buildMetricSeries(
      [
        { delta: 1, occurred_at: new Date('2026-07-27T12:03:00Z') },
        { delta: 2, occurred_at: new Date('2026-07-27T12:04:50Z') },
        { delta: 10, occurred_at: new Date('2026-07-27T12:07:00Z') },
      ],
      {
        period: MetricSeriesPeriod.MINUTE_5,
        from: new Date('2026-07-27T12:00:00Z'),
        to: new Date('2026-07-27T12:05:00Z'),
        target_value: 20,
      }
    );

    expect(points).toHaveLength(2);
    expect(points[0].delta).toBe(3); // 12:00–12:05
    expect(points[1].delta).toBe(10); // 12:05–12:10
  });
});
