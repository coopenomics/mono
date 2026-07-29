import { MetricSeriesPeriod } from '../enums/metric-series-period.enum';

export interface MetricSeriesContributionInput {
  delta: number;
  occurred_at: Date;
}

export interface MetricSeriesPointResult {
  period_start: Date;
  period_end: Date;
  delta: number;
  cumulative: number;
  ideal_cumulative: number | null;
}

export interface BuildMetricSeriesOptions {
  period: MetricSeriesPeriod;
  from: Date;
  to: Date;
  target_value: number;
  /** Начало плана для идеальной линии burn-up; если нет — ideal = null */
  plan_start?: Date | null;
  /** Дедлайн для идеальной линии; если нет — ideal = null */
  deadline?: Date | null;
}

function startOfUtcMinute(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes())
  );
}

/** Начало N-минутного бакета (N=5 → :00/:05/:10…; N=15 → :00/:15/:30/:45) */
function startOfUtcMinuteBucket(d: Date, bucketMinutes: number): Date {
  const start = startOfUtcMinute(d);
  const floored = Math.floor(start.getUTCMinutes() / bucketMinutes) * bucketMinutes;
  start.setUTCMinutes(floored, 0, 0);
  return start;
}

function startOfUtcHour(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours()));
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Понедельник 00:00 UTC недели, содержащей дату */
function startOfUtcWeek(d: Date): Date {
  const day = startOfUtcDay(d);
  const weekday = day.getUTCDay(); // 0=Sun
  const offset = weekday === 0 ? -6 : 1 - weekday;
  day.setUTCDate(day.getUTCDate() + offset);
  return day;
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addPeriod(start: Date, period: MetricSeriesPeriod): Date {
  const next = new Date(start.getTime());
  switch (period) {
    case MetricSeriesPeriod.MINUTE:
      next.setUTCMinutes(next.getUTCMinutes() + 1);
      break;
    case MetricSeriesPeriod.MINUTE_5:
      next.setUTCMinutes(next.getUTCMinutes() + 5);
      break;
    case MetricSeriesPeriod.MINUTE_15:
      next.setUTCMinutes(next.getUTCMinutes() + 15);
      break;
    case MetricSeriesPeriod.HOUR:
      next.setUTCHours(next.getUTCHours() + 1);
      break;
    case MetricSeriesPeriod.DAY:
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case MetricSeriesPeriod.WEEK:
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case MetricSeriesPeriod.MONTH:
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
  }
  return next;
}

function periodStartOf(d: Date, period: MetricSeriesPeriod): Date {
  switch (period) {
    case MetricSeriesPeriod.MINUTE:
      return startOfUtcMinute(d);
    case MetricSeriesPeriod.MINUTE_5:
      return startOfUtcMinuteBucket(d, 5);
    case MetricSeriesPeriod.MINUTE_15:
      return startOfUtcMinuteBucket(d, 15);
    case MetricSeriesPeriod.HOUR:
      return startOfUtcHour(d);
    case MetricSeriesPeriod.DAY:
      return startOfUtcDay(d);
    case MetricSeriesPeriod.WEEK:
      return startOfUtcWeek(d);
    case MetricSeriesPeriod.MONTH:
      return startOfUtcMonth(d);
  }
}

/**
 * Правая граница окна (exclusive).
 * Если `to` ровно на старте бакета (= period_end предыдущего) — бакет,
 * начинающийся в `to`, не включаем: кадр истории не должен получать
 * пустой «будущий» бар и ложную коррекцию волны.
 * Если `to` внутри бакета — включаем этот (неполный) бакет.
 */
export function exclusiveEndOf(to: Date, period: MetricSeriesPeriod): Date {
  const start = periodStartOf(to, period);
  if (start.getTime() === to.getTime()) {
    return new Date(to.getTime());
  }
  return addPeriod(start, period);
}

function idealAt(
  at: Date,
  planStart: Date | null | undefined,
  deadline: Date | null | undefined,
  target: number
): number | null {
  if (!planStart || !deadline) {
    return null;
  }
  const startMs = planStart.getTime();
  const endMs = deadline.getTime();
  if (endMs <= startMs) {
    return target;
  }
  const t = at.getTime();
  if (t <= startMs) return 0;
  if (t >= endMs) return target;
  return (target * (t - startMs)) / (endMs - startMs);
}

/**
 * Строит ряд: delta за период + накопленный fact + идеальная линия к дедлайну.
 * Пустые периоды между from и to заполняются нулевым delta.
 */
export function buildMetricSeries(
  contributions: MetricSeriesContributionInput[],
  options: BuildMetricSeriesOptions
): MetricSeriesPointResult[] {
  const { period, target_value, plan_start, deadline } = options;
  const from = periodStartOf(options.from, period);
  const toExclusive = exclusiveEndOf(options.to, period);

  const bucketDelta = new Map<number, number>();
  for (const c of contributions) {
    const occurred = c.occurred_at instanceof Date ? c.occurred_at : new Date(c.occurred_at);
    if (occurred < from || occurred >= toExclusive) {
      continue;
    }
    const key = periodStartOf(occurred, period).getTime();
    bucketDelta.set(key, (bucketDelta.get(key) ?? 0) + c.delta);
  }

  // Накопленный fact до начала окна (вклады раньше from)
  let cumulative = 0;
  for (const c of contributions) {
    const occurred = c.occurred_at instanceof Date ? c.occurred_at : new Date(c.occurred_at);
    if (occurred < from) {
      cumulative += c.delta;
    }
  }

  const points: MetricSeriesPointResult[] = [];
  let cursor = from;
  while (cursor < toExclusive) {
    const period_start = new Date(cursor.getTime());
    const period_end = addPeriod(cursor, period);
    const delta = bucketDelta.get(cursor.getTime()) ?? 0;
    cumulative += delta;
    points.push({
      period_start,
      period_end,
      delta,
      cumulative,
      ideal_cumulative: idealAt(period_end, plan_start, deadline, target_value),
    });
    cursor = period_end;
  }

  return points;
}
