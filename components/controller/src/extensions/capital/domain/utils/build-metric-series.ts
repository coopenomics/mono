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
  from: Date;
  to: Date;
  target_value: number;
  /** Начало плана для идеальной линии burn-up; если нет — ideal = null */
  plan_start?: Date | null;
  /** Дедлайн для идеальной линии; если нет — ideal = null */
  deadline?: Date | null;
}

/** Ряд метрики считается только по дням: один бакет = сутки UTC. */
export const METRIC_SERIES_UNIT = 'day';

/** Глубина окна ряда по умолчанию — 30 дневных баров */
export const METRIC_SERIES_LOOKBACK_DAYS = 29;

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDay(start: Date): Date {
  const next = new Date(start.getTime());
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/**
 * Правая граница окна (exclusive).
 * Если `to` ровно на старте суток (= period_end предыдущего дня) — день,
 * начинающийся в `to`, не включаем: кадр истории не должен получать
 * пустой «будущий» бар и ложную коррекцию волны.
 * Если `to` внутри суток — включаем этот (неполный) день.
 */
export function exclusiveEndOf(to: Date): Date {
  const start = startOfUtcDay(to);
  if (start.getTime() === to.getTime()) {
    return new Date(to.getTime());
  }
  return addDay(start);
}

/** Начало окна ряда: `lookbackDays` дней назад от `to`. */
export function defaultSeriesFrom(to: Date, lookbackDays = METRIC_SERIES_LOOKBACK_DAYS): Date {
  const from = new Date(to.getTime());
  from.setUTCDate(from.getUTCDate() - lookbackDays);
  return from;
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
 * Строит дневной ряд: delta за сутки + накопленный fact + идеальная линия к дедлайну.
 * Пустые дни между from и to заполняются нулевым delta — календарный ноль
 * это часть ряда, синтетикой его не подменяем.
 */
export function buildMetricSeries(
  contributions: MetricSeriesContributionInput[],
  options: BuildMetricSeriesOptions
): MetricSeriesPointResult[] {
  const { target_value, plan_start, deadline } = options;
  const from = startOfUtcDay(options.from);
  const toExclusive = exclusiveEndOf(options.to);

  const bucketDelta = new Map<number, number>();
  for (const c of contributions) {
    const occurred = c.occurred_at instanceof Date ? c.occurred_at : new Date(c.occurred_at);
    if (occurred < from || occurred >= toExclusive) {
      continue;
    }
    const key = startOfUtcDay(occurred).getTime();
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
    const period_end = addDay(cursor);
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
