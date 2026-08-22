/**
 * Расчёт резонанса метрик на момент времени T (окно [from, to]).
 * Общий код для «сейчас» и истории кадров scrubber'а.
 *
 * Единственный таймфрейм — день: и ряд метрики, и кадры истории.
 */
import { MetricSeriesMode } from '../enums/metric-series-mode.enum';
import { MetricDriveDirection } from '../enums/metric-drive-direction.enum';
import { buildMetricSeries, defaultSeriesFrom } from './build-metric-series';
import {
  analyzeWave,
  recentActivityScore,
  WaveLabel,
  WavePhase,
} from './wave-markup';
import {
  superposeMetricPhasors,
  wavePhaseRadians,
  type MetricPhasorSuperposition,
} from './metric-phasors';

export interface SuperpositionMetricInput {
  metric_hash: string;
  project_hash: string;
  project_title: string;
  title: string;
  unit: string;
  target_value: number;
  series_mode: MetricSeriesMode;
  plan_start: Date | null;
  deadline: Date | null;
}

export interface SuperpositionContributionInput {
  delta: number;
  occurred_at: Date;
}

export interface SuperpositionItemResult {
  project_hash: string;
  project_title: string;
  metric_hash: string;
  title: string;
  unit: string;
  fact: number;
  target_value: number;
  series_mode: MetricSeriesMode;
  current_label: WaveLabel;
  current_phase: WavePhase;
  recent_velocity: number;
  drive: MetricDriveDirection;
  amplitude: number;
  phase_rad: number;
}

export interface SuperpositionAtResult extends MetricPhasorSuperposition {
  items: SuperpositionItemResult[];
  fact_sum: number;
  target_sum: number;
  up_count: number;
  down_count: number;
  flat_count: number;
}

export function driveOf(
  label: WaveLabel,
  phase: WavePhase,
  recentVelocity: number
): MetricDriveDirection {
  if (Math.abs(recentVelocity) < 1e-9) {
    return MetricDriveDirection.FLAT;
  }
  const upwardLabels = [WaveLabel.W1, WaveLabel.W3, WaveLabel.W5];
  if (phase === WavePhase.IMPULSE && upwardLabels.includes(label) && recentVelocity > 0) {
    return MetricDriveDirection.UP;
  }
  if (phase === WavePhase.CORRECTION || label === WaveLabel.W2 || recentVelocity < 0) {
    return MetricDriveDirection.DOWN;
  }
  if (recentVelocity > 0) {
    return MetricDriveDirection.UP;
  }
  return MetricDriveDirection.FLAT;
}

/** Концы дневных бакетов окна [from, to] — метки кадров истории (не дальше `to`). */
export function listSuperpositionFrameAts(from: Date, to: Date): Date[] {
  const toMs = to.getTime();
  const points = buildMetricSeries([], {
    from,
    to,
    target_value: 0,
  });
  // period_end текущего дня может быть в будущем относительно `to` —
  // кадр истории отмечаем моментом `to`, а не концом незавершённых суток.
  return points.map((p) => new Date(Math.min(p.period_end.getTime(), toMs)));
}

/**
 * Резонанс на момент `to`.
 * Ряд каждой метрики — дневной, окно lookback отсчитывается от `to`.
 * Вклады с occurred_at > to не учитываются.
 */
export function computeSuperpositionAt(
  metrics: SuperpositionMetricInput[],
  contributionsByMetric: Map<string, SuperpositionContributionInput[]>,
  to: Date
): SuperpositionAtResult {
  const items: SuperpositionItemResult[] = [];

  for (const metric of metrics) {
    const key = metric.metric_hash.toLowerCase();
    const all = contributionsByMetric.get(key) ?? [];
    const contributions = all.filter((c) => {
      const at = c.occurred_at instanceof Date ? c.occurred_at : new Date(c.occurred_at);
      return at.getTime() <= to.getTime();
    });
    const fact = contributions.reduce((s, c) => s + c.delta, 0);
    const metricFrom = defaultSeriesFrom(to);
    const planStart = metric.plan_start ?? metricFrom;
    const points = buildMetricSeries(
      contributions.map((c) => ({ delta: c.delta, occurred_at: c.occurred_at })),
      {
        from: metricFrom,
        to,
        target_value: metric.target_value,
        plan_start: planStart,
        deadline: metric.deadline,
      }
    );
    const values =
      metric.series_mode === MetricSeriesMode.LEVEL
        ? points.map((p) => p.cumulative)
        : points.map((p) => p.delta);
    const markup = analyzeWave({
      values,
      series_mode: metric.series_mode,
      fact,
      target_value: metric.target_value,
    });
    const recent_velocity = points.length ? points[points.length - 1].delta : 0;
    const amplitude = recentActivityScore(values, metric.series_mode);
    const phase_rad = wavePhaseRadians(markup.current_phase, markup.current_label);
    items.push({
      project_hash: metric.project_hash,
      project_title: metric.project_title,
      metric_hash: metric.metric_hash,
      title: metric.title,
      unit: metric.unit,
      fact,
      target_value: metric.target_value,
      series_mode: metric.series_mode,
      current_label: markup.current_label,
      current_phase: markup.current_phase,
      recent_velocity,
      drive: driveOf(markup.current_label, markup.current_phase, recent_velocity),
      amplitude,
      phase_rad,
    });
  }

  const phasors = superposeMetricPhasors(
    items.map((i) => ({ amplitude: i.amplitude, phase_rad: i.phase_rad }))
  );

  return {
    ...phasors,
    items,
    fact_sum: items.reduce((s, i) => s + i.fact, 0),
    target_sum: items.reduce((s, i) => s + i.target_value, 0),
    up_count: items.filter((i) => i.drive === MetricDriveDirection.UP).length,
    down_count: items.filter((i) => i.drive === MetricDriveDirection.DOWN).length,
    flat_count: items.filter((i) => i.drive === MetricDriveDirection.FLAT).length,
  };
}

/** Lookback-окно дневного ряда относительно `to`. */
export function defaultSuperpositionFrom(to: Date): Date {
  return defaultSeriesFrom(to);
}
