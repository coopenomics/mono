import { MetricSeriesMode } from '../enums/metric-series-mode.enum';
import { MetricSeriesPeriod } from '../enums/metric-series-period.enum';
import {
  computeSuperpositionAt,
  defaultSuperpositionFrom,
  listSuperpositionFrameAts,
  type SuperpositionMetricInput,
} from './compute-metric-superposition';

const metricA: SuperpositionMetricInput = {
  metric_hash: 'm1',
  project_hash: 'p1',
  project_title: 'Comp',
  title: 'A',
  unit: 'шт',
  target_value: 100,
  series_mode: MetricSeriesMode.RATE,
  wave_period: MetricSeriesPeriod.DAY,
  plan_start: new Date('2026-01-01T00:00:00.000Z'),
  deadline: new Date('2026-12-31T00:00:00.000Z'),
};

const metricB: SuperpositionMetricInput = {
  ...metricA,
  metric_hash: 'm2',
  title: 'B',
};

describe('compute-metric-superposition', () => {
  it('покой: нет вкладов → balance≈1, growth≈0', () => {
    const to = new Date('2026-07-28T12:00:00.000Z');
    const from = defaultSuperpositionFrom(to, MetricSeriesPeriod.DAY);
    const r = computeSuperpositionAt(
      [metricA, metricB],
      new Map([
        ['m1', []],
        ['m2', []],
      ]),
      MetricSeriesPeriod.DAY,
      from,
      to
    );
    expect(r.activity).toBe(0);
    expect(r.balance).toBe(1);
    expect(r.growth).toBe(0);
    expect(r.items).toHaveLength(2);
  });

  it('усечение: вклад после to не входит в fact и фазоры', () => {
    const to = new Date('2026-07-15T00:00:00.000Z');
    const from = defaultSuperpositionFrom(to, MetricSeriesPeriod.DAY);
    const contribs = new Map([
      [
        'm1',
        [
          { delta: 10, occurred_at: new Date('2026-07-10T12:00:00.000Z') },
          { delta: 50, occurred_at: new Date('2026-07-20T12:00:00.000Z') },
        ],
      ],
    ]);
    const r = computeSuperpositionAt(
      [metricA],
      contribs,
      MetricSeriesPeriod.DAY,
      from,
      to
    );
    expect(r.fact_sum).toBe(10);
    expect(r.items[0].fact).toBe(10);
  });

  it('история кадров: синхронный рост поднимает growth на поздних кадрах', () => {
    const windowTo = new Date('2026-07-20T12:00:00.000Z');
    const windowFrom = new Date('2026-07-10T00:00:00.000Z');
    const frameAts = listSuperpositionFrameAts(
      windowFrom,
      windowTo,
      MetricSeriesPeriod.DAY
    );
    expect(frameAts.length).toBeGreaterThan(3);

    const contribs = new Map([
      [
        'm1',
        [
          { delta: 5, occurred_at: new Date('2026-07-12T10:00:00.000Z') },
          { delta: 5, occurred_at: new Date('2026-07-14T10:00:00.000Z') },
          { delta: 5, occurred_at: new Date('2026-07-16T10:00:00.000Z') },
          { delta: 5, occurred_at: new Date('2026-07-18T10:00:00.000Z') },
        ],
      ],
      [
        'm2',
        [
          { delta: 5, occurred_at: new Date('2026-07-12T11:00:00.000Z') },
          { delta: 5, occurred_at: new Date('2026-07-14T11:00:00.000Z') },
          { delta: 5, occurred_at: new Date('2026-07-16T11:00:00.000Z') },
          { delta: 5, occurred_at: new Date('2026-07-18T11:00:00.000Z') },
        ],
      ],
    ]);

    const earlyAt = frameAts[1];
    const lateAt = frameAts[frameAts.length - 1];
    const early = computeSuperpositionAt(
      [metricA, metricB],
      contribs,
      MetricSeriesPeriod.DAY,
      defaultSuperpositionFrom(earlyAt, MetricSeriesPeriod.DAY),
      earlyAt
    );
    const late = computeSuperpositionAt(
      [metricA, metricB],
      contribs,
      MetricSeriesPeriod.DAY,
      defaultSuperpositionFrom(lateAt, MetricSeriesPeriod.DAY),
      lateAt
    );

    expect(late.fact_sum).toBeGreaterThan(early.fact_sum);
    expect(late.growth).toBeGreaterThanOrEqual(0);
  });

  it('кадр на period_end дня с вкладом: импульс и growth>0 (без ложного нулевого бакета)', () => {
    const to = new Date('2026-07-28T19:05:00.000Z');
    const from = defaultSuperpositionFrom(to, MetricSeriesPeriod.DAY);
    const frameAts = listSuperpositionFrameAts(from, to, MetricSeriesPeriod.DAY);
    const lastAt = frameAts[frameAts.length - 1];
    // последний кадр упирается в `to`, а не в будущий period_end
    expect(lastAt.toISOString()).toBe('2026-07-28T19:05:00.000Z');

    const contribs = new Map([
      [
        'm1',
        [{ delta: 6, occurred_at: new Date('2026-07-28T19:00:00.000Z') }],
      ],
      [
        'm2',
        [{ delta: 8, occurred_at: new Date('2026-07-28T19:00:00.000Z') }],
      ],
    ]);

    const r = computeSuperpositionAt(
      [metricA, metricB],
      contribs,
      MetricSeriesPeriod.DAY,
      defaultSuperpositionFrom(lastAt, MetricSeriesPeriod.DAY),
      lastAt
    );

    expect(r.growth).toBeGreaterThan(0.5);
    expect(r.items.every((i) => i.phase_rad < 0.5)).toBe(true);
  });

  it('недельный кадр не гасит рост пустыми днями из будущего', () => {
    const to = new Date('2026-07-28T19:05:00.000Z');
    const from = defaultSuperpositionFrom(to, MetricSeriesPeriod.WEEK);
    const frameAts = listSuperpositionFrameAts(from, to, MetricSeriesPeriod.WEEK);
    const lastAt = frameAts[frameAts.length - 1];
    expect(lastAt.getTime()).toBe(to.getTime());

    const contribs = new Map([
      ['m1', [{ delta: 6, occurred_at: new Date('2026-07-28T19:00:00.000Z') }]],
      ['m2', [{ delta: 8, occurred_at: new Date('2026-07-28T19:00:00.000Z') }]],
    ]);

    const r = computeSuperpositionAt(
      [metricA, metricB],
      contribs,
      MetricSeriesPeriod.WEEK,
      defaultSuperpositionFrom(lastAt, MetricSeriesPeriod.WEEK),
      lastAt
    );

    expect(r.growth).toBeGreaterThan(0.5);
    expect(r.activity).toBeGreaterThan(0.5);
  });
});
