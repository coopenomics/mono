import { MetricSeriesMode } from '../enums/metric-series-mode.enum';

/** Классические Фибо-уровни для сетки и норм волн */
export const FIB_RATIOS = [0.236, 0.382, 0.5, 0.618, 1.0, 1.618, 2.618] as const;

export enum WaveLabel {
  W1 = 'W1',
  W2 = 'W2',
  W3 = 'W3',
  W4 = 'W4',
  W5 = 'W5',
  WA = 'WA',
  WB = 'WB',
  WC = 'WC',
}

export enum WavePhase {
  IMPULSE = 'IMPULSE',
  CORRECTION = 'CORRECTION',
}

const IMPULSE_SEQUENCE: WaveLabel[] = [
  WaveLabel.W1,
  WaveLabel.W2,
  WaveLabel.W3,
  WaveLabel.W4,
  WaveLabel.W5,
];

const CORRECTION_SEQUENCE: WaveLabel[] = [WaveLabel.WA, WaveLabel.WB, WaveLabel.WC];

const FULL_CYCLE: WaveLabel[] = [...IMPULSE_SEQUENCE, ...CORRECTION_SEQUENCE];

export interface WaveSwing {
  index: number;
  value: number;
  label: WaveLabel;
}

export interface FibLevel {
  ratio: number;
  value: number;
}

export interface ForecastCorridor {
  /** Горизонт прогноза в периодах */
  periods_ahead: number;
  /** Прогноз значений анализируемого ряда (скорость или уровень) */
  optimistic: number[];
  base: number[];
  pessimistic: number[];
  /** Оценка числа периодов до цели по накопленному факту; null если цель уже достигнута / недостижима */
  eta_optimistic_periods: number | null;
  eta_base_periods: number | null;
  eta_pessimistic_periods: number | null;
}

export interface WaveMarkupResult {
  series_kind: MetricSeriesMode;
  current_label: WaveLabel;
  current_phase: WavePhase;
  swings: WaveSwing[];
  /** Подпись волны на каждой точке ряда (между свингами — текущая незакрытая) */
  point_labels: Array<WaveLabel | null>;
  fib_levels: FibLevel[];
  corridor: ForecastCorridor;
  disclaimer: string;
}

export interface AnalyzeWaveInput {
  /** Ряд для разметки: Δ (rate) или уровень (level) */
  values: number[];
  series_mode: MetricSeriesMode;
  /** Текущий накопленный fact (для ETA) */
  fact: number;
  target_value: number;
  /** Сколько периодов вперёд рисовать коридор */
  periods_ahead?: number;
}

export const WAVE_DISCLAIMER =
  'Рабочая разметка, пересматривается с каждой новой точкой — не установленный факт.';

function phaseOf(label: WaveLabel): WavePhase {
  return IMPULSE_SEQUENCE.includes(label) ? WavePhase.IMPULSE : WavePhase.CORRECTION;
}

/**
 * Zigzag-свинги: локальные экстремумы с минимальным относительным ходом.
 * При коротком ряде — стартовая и последняя точки как зачатки волн.
 */
export function detectSwings(values: number[]): Array<{ index: number; value: number }> {
  if (values.length === 0) return [];
  if (values.length === 1) return [{ index: 0, value: values[0] }];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max), Math.abs(min), 1e-9);
  const threshold = range * 0.08;

  const raw: Array<{ index: number; value: number; kind: 'high' | 'low' }> = [];
  raw.push({
    index: 0,
    value: values[0],
    kind: values[1] >= values[0] ? 'low' : 'high',
  });

  for (let i = 1; i < values.length - 1; i++) {
    const prev = values[i - 1];
    const cur = values[i];
    const next = values[i + 1];
    const isHigh = cur >= prev && cur >= next;
    const isLow = cur <= prev && cur <= next;
    if (isHigh) raw.push({ index: i, value: cur, kind: 'high' });
    if (isLow) raw.push({ index: i, value: cur, kind: 'low' });
  }

  raw.push({
    index: values.length - 1,
    value: values[values.length - 1],
    kind: values[values.length - 1] >= values[values.length - 2] ? 'high' : 'low',
  });

  // Сжимаем: чередование high/low и порог хода
  const filtered: Array<{ index: number; value: number }> = [];
  for (const pivot of raw) {
    if (filtered.length === 0) {
      filtered.push({ index: pivot.index, value: pivot.value });
      continue;
    }
    const last = filtered[filtered.length - 1];
    if (pivot.index === last.index) continue;
    const move = Math.abs(pivot.value - last.value);
    if (move < threshold && pivot.index !== values.length - 1) {
      // обновляем экстремум того же направления
      const goingUp = pivot.value > last.value;
      const prevPrev = filtered.length >= 2 ? filtered[filtered.length - 2] : null;
      if (prevPrev) {
        const wasUp = last.value > prevPrev.value;
        if (goingUp === wasUp) {
          filtered[filtered.length - 1] = { index: pivot.index, value: pivot.value };
        }
      }
      continue;
    }
    filtered.push({ index: pivot.index, value: pivot.value });
  }

  // Убираем подряд идущие в одном направлении — оставляем крайний
  const swings: Array<{ index: number; value: number }> = [];
  for (const p of filtered) {
    if (swings.length < 2) {
      swings.push(p);
      continue;
    }
    const a = swings[swings.length - 2];
    const b = swings[swings.length - 1];
    const dirPrev = Math.sign(b.value - a.value);
    const dirNext = Math.sign(p.value - b.value);
    if (dirPrev !== 0 && dirNext === dirPrev) {
      swings[swings.length - 1] = p;
    } else {
      swings.push(p);
    }
  }

  return swings;
}

function labelSwings(swings: Array<{ index: number; value: number }>): WaveSwing[] {
  return swings.map((s, i) => ({
    ...s,
    label: FULL_CYCLE[i % FULL_CYCLE.length],
  }));
}

function buildPointLabels(
  length: number,
  swings: WaveSwing[]
): Array<WaveLabel | null> {
  const labels: Array<WaveLabel | null> = Array(length).fill(null);
  if (swings.length === 0) return labels;

  for (let i = 0; i < swings.length; i++) {
    const start = swings[i].index;
    const end = i + 1 < swings.length ? swings[i + 1].index : length;
    const label = swings[i].label;
    for (let j = start; j < end; j++) {
      labels[j] = label;
    }
    labels[start] = label;
  }
  // последняя точка — текущая незакрытая волна (последний свинг)
  labels[length - 1] = swings[swings.length - 1].label;
  return labels;
}

/**
 * Фибо-сетка от базы последнего импульсного хода (W1→текущий экстремум или W1→W5).
 */
export function buildFibLevels(swings: WaveSwing[]): FibLevel[] {
  if (swings.length < 2) return [];

  // Ищем старт W1 в последнем импульсном цикле
  let startIdx = 0;
  for (let i = swings.length - 1; i >= 0; i--) {
    if (swings[i].label === WaveLabel.W1) {
      startIdx = i;
      break;
    }
  }
  const start = swings[startIdx];
  const end = swings[swings.length - 1];
  const span = end.value - start.value;
  if (Math.abs(span) < 1e-12) return [];

  return FIB_RATIOS.map((ratio) => ({
    ratio,
    value: start.value + span * ratio,
  }));
}

function wave1Amplitude(swings: WaveSwing[]): number | null {
  const w1 = swings.findIndex((s) => s.label === WaveLabel.W1);
  if (w1 < 0 || w1 + 1 >= swings.length) {
    if (swings.length >= 2) {
      return Math.abs(swings[1].value - swings[0].value);
    }
    return null;
  }
  return Math.abs(swings[w1 + 1].value - swings[w1].value);
}

function meanAbsStep(values: number[]): number {
  if (values.length < 2) {
    return Math.max(Math.abs(values[0] ?? 0), 1);
  }
  let sum = 0;
  for (let i = 1; i < values.length; i++) {
    sum += Math.abs(values[i] - values[i - 1]);
  }
  return Math.max(sum / (values.length - 1), 1e-9);
}

/**
 * Нормы следующего шага относительно амплитуды W1 (модель Фибо, не статистика).
 * optimistic / base / pessimistic — множители ожидаемого |хода| за период.
 */
function stepMultipliers(current: WaveLabel): { opt: number; base: number; pess: number } {
  switch (current) {
    case WaveLabel.W1:
      return { opt: 1.0, base: 0.8, pess: 0.5 };
    case WaveLabel.W2:
      // коррекция ~0.5–0.618 W1
      return { opt: 0.382, base: 0.5, pess: 0.618 };
    case WaveLabel.W3:
      // обычно самая сильная ~1.618 W1
      return { opt: 1.618, base: 1.0, pess: 0.618 };
    case WaveLabel.W4:
      return { opt: 0.236, base: 0.382, pess: 0.5 };
    case WaveLabel.W5:
      return { opt: 1.0, base: 0.618, pess: 0.382 };
    case WaveLabel.WA:
      return { opt: 0.618, base: 0.5, pess: 0.382 };
    case WaveLabel.WB:
      return { opt: 0.5, base: 0.382, pess: 0.236 };
    case WaveLabel.WC:
      return { opt: 1.0, base: 0.618, pess: 0.382 };
    default:
      return { opt: 1.0, base: 0.618, pess: 0.382 };
  }
}

function expectedDirection(swings: WaveSwing[], current: WaveLabel): number {
  // Импульсные нечётные / A,C — по тренду первой волны; чётные и B — против
  const withTrend = [WaveLabel.W1, WaveLabel.W3, WaveLabel.W5, WaveLabel.WA, WaveLabel.WC];
  let trend = 1;
  if (swings.length >= 2) {
    const w1 = swings.find((s) => s.label === WaveLabel.W1) ?? swings[0];
    const next = swings.find((s) => s.index > w1.index) ?? swings[1];
    trend = Math.sign(next.value - w1.value) || 1;
  }
  return withTrend.includes(current) ? trend : -trend;
}

function projectCorridor(
  values: number[],
  swings: WaveSwing[],
  current: WaveLabel,
  seriesMode: MetricSeriesMode,
  fact: number,
  target: number,
  periodsAhead: number
): ForecastCorridor {
  const amp = wave1Amplitude(swings) ?? meanAbsStep(values);
  const mult = stepMultipliers(current);
  const dir = expectedDirection(swings, current);
  const last = values.length ? values[values.length - 1] : 0;

  const makeSeries = (periodStep: number): number[] => {
    const out: number[] = [];
    let v = last;
    for (let i = 0; i < periodsAhead; i++) {
      if (seriesMode === MetricSeriesMode.RATE) {
        // для скорости прогнозируем сам Δ; шаг = amp * multiplier * dir / типичная длина волны (~3 периода)
        out.push(periodStep);
      } else {
        v += periodStep;
        out.push(v);
      }
    }
    return out;
  };

  const perPeriod = (m: number) => (dir * amp * m) / 3;

  const optimistic = makeSeries(perPeriod(mult.opt));
  const base = makeSeries(perPeriod(mult.base));
  const pessimistic = makeSeries(perPeriod(mult.pess));

  const eta = (projected: number[], m: number): number | null => {
    if (fact >= target) return 0;
    const remaining = target - fact;
    if (seriesMode === MetricSeriesMode.RATE) {
      // интегрируем ожидаемые Δ
      let acc = 0;
      for (let i = 0; i < projected.length; i++) {
        acc += projected[i];
        if (acc >= remaining) return i + 1;
      }
      const step = perPeriod(m);
      if (step <= 0) return null;
      return projected.length + Math.ceil((remaining - acc) / step);
    }
    // level: когда прогнозный уровень >= target (или <= для нисходящей цели)
    for (let i = 0; i < projected.length; i++) {
      if (remaining >= 0 && projected[i] >= target) return i + 1;
      if (remaining < 0 && projected[i] <= target) return i + 1;
    }
    const step = perPeriod(m);
    if (step === 0) return null;
    const lastProj = projected[projected.length - 1] ?? last;
    const need = target - lastProj;
    if (Math.sign(need) !== Math.sign(step) && Math.sign(need) !== 0) return null;
    return projected.length + Math.ceil(Math.abs(need) / Math.abs(step));
  };

  return {
    periods_ahead: periodsAhead,
    optimistic,
    base,
    pessimistic,
    eta_optimistic_periods: eta(optimistic, mult.opt),
    eta_base_periods: eta(base, mult.base),
    eta_pessimistic_periods: eta(pessimistic, mult.pess),
  };
}

/**
 * Разметка волны 5/3 + Фибо-сетка + прогнозный коридор.
 * Чистая функция: без БД, модель априори, с первой точки.
 */
export function analyzeWave(input: AnalyzeWaveInput): WaveMarkupResult {
  const values = input.values;
  const periodsAhead = input.periods_ahead ?? 8;

  if (values.length === 0) {
    return {
      series_kind: input.series_mode,
      current_label: WaveLabel.W1,
      current_phase: WavePhase.IMPULSE,
      swings: [],
      point_labels: [],
      fib_levels: [],
      corridor: {
        periods_ahead: periodsAhead,
        optimistic: [],
        base: [],
        pessimistic: [],
        eta_optimistic_periods: null,
        eta_base_periods: null,
        eta_pessimistic_periods: null,
      },
      disclaimer: WAVE_DISCLAIMER,
    };
  }

  const rawSwings = detectSwings(values);
  const swings = labelSwings(rawSwings);
  const current_label = swings[swings.length - 1]?.label ?? WaveLabel.W1;
  const point_labels = buildPointLabels(values.length, swings);
  const fib_levels = buildFibLevels(swings);
  const corridor = projectCorridor(
    values,
    swings,
    current_label,
    input.series_mode,
    input.fact,
    input.target_value,
    periodsAhead
  );

  return {
    series_kind: input.series_mode,
    current_label,
    current_phase: phaseOf(current_label),
    swings,
    point_labels,
    fib_levels,
    corridor,
    disclaimer: WAVE_DISCLAIMER,
  };
}
