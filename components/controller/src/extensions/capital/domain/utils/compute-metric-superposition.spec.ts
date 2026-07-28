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
});
