/**
 * Волновой прогноз метрики (под капотом UI).
 *
 * Модель (упрощённый Эллиотт на две ноги):
 * - Точка 0 = старт ряда (не нумеруется).
 * - Волна 1 = первый значимый экстремум по тренду.
 * - Коррекция: уровни 0.382 / 0.5 / 0.618 отхода от хода 0→1.
 * - Следующий импульс: от уровня коррекции × 1.618 амплитуды волны 1.
 *
 * На каком ряде строится:
 * - MetricSeriesMode.RATE — на Δ за период (счётчики вроде «новые пользователи»).
 * - MetricSeriesMode.LEVEL — на уровне значения (может откатываться).
 *
 * Затухание / «стоим на месте»:
 * - recentActivityScore → [0..1] по энергии последних периодов.
 * - activity≈0 → коридор схлопывается в [last, last] (плоский прогноз на факте).
 * - activity→1 → полный волновой сценарий; малое действие — частичный разгон.
 *   (если долго нет ±, вероятность «выстрела» считаем нулевой — не тянем вверх/вниз.)
 *
 * RATE/LEVEL: календарные нули — часть ряда, их не выкидываем и не подменяем
 * синтетикой. Ноль = ноль в таймфрейме.
 *
 * UI не рисует свинги/фибо-сетку: только сценарии коридора
 * (на UI сейчас base = 0.5→1.618), которые фронт проецирует
 * на накопление и динамику (см. desktop projectMetricForecast.ts).
 */
import { MetricSeriesMode } from '../enums/metric-series-mode.enum';

/** Основные ретрейсменты коррекции после волны 1 */
export const CORRECTION_RATIOS = [0.382, 0.5, 0.618] as const;

/** Удлинение следующего импульса от дна коррекции */
export const IMPULSE_EXTENSION = 1.618;

/**
 * Энергия движения за последние lookback периодов → [0..1].
 * 0 — ряд стоит (LEVEL: уровень не меняется / RATE: Δ≈0);
 * 1 — есть заметная активность (полный волновой разгон).
 */
export function recentActivityScore(
  values: number[],
  mode: MetricSeriesMode,
  lookback = 4
): number {
  if (values.length < 2) return 0;
  const n = Math.min(lookback, values.length - 1);
  let energy = 0;
  const start = values.length - n;
  for (let i = start; i < values.length; i++) {
    if (mode === MetricSeriesMode.RATE) {
      energy += Math.abs(values[i]);
    } else {
      energy += Math.abs(values[i] - values[i - 1]);
    }
  }
  const peak = Math.max(...values.map((v) => Math.abs(v)), 1e-9);
  // «полная» активность: суммарный ход порядка 15% пика на каждый период lookback
  const full = peak * 0.15 * n;
  return Math.max(0, Math.min(1, energy / full));
}

/** Смешивает волновой путь к плоскому [last,last] при низкой активности. */
export function blendPathWithActivity(
  path: number[],
  last: number,
  activity: number
): number[] {
  const a = Math.max(0, Math.min(1, activity));
  return path.map((v) => last + (v - last) * a);
}

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
  periods_ahead: number;
  /** Сценарий мелкой коррекции 0.382 → импульс 1.618: [correction, impulse] */
  optimistic: number[];
  /** Сценарий 0.5 → импульс 1.618 */
  base: number[];
  /** Сценарий глубокой коррекции 0.618 → импульс 1.618 */
  pessimistic: number[];
  eta_optimistic_periods: number | null;
  eta_base_periods: number | null;
  eta_pessimistic_periods: number | null;
}

export interface WaveMarkupResult {
  series_kind: MetricSeriesMode;
  current_label: WaveLabel;
  current_phase: WavePhase;
  /** Только завершённые волны: W1 на конце первой, W2 на дне коррекции (если есть) */
  swings: WaveSwing[];
  point_labels: Array<WaveLabel | null>;
  /** Уровни коррекции 0.382 / 0.5 / 0.618 от хода 0→1 */
  fib_levels: FibLevel[];
  corridor: ForecastCorridor;
  disclaimer: string;
  /** Старт отсчёта волны (точка 0), не подписывается на графике */
  origin: { index: number; value: number } | null;
  wave1_amplitude: number;
}

export interface AnalyzeWaveInput {
  values: number[];
  series_mode: MetricSeriesMode;
  fact: number;
  target_value: number;
  periods_ahead?: number;
}

export const WAVE_DISCLAIMER =
  'Рабочая разметка, пересматривается с каждой новой точкой — не установленный факт.';

function emptyCorridor(periodsAhead: number): ForecastCorridor {
  return {
    periods_ahead: periodsAhead,
    optimistic: [],
    base: [],
    pessimistic: [],
    eta_optimistic_periods: null,
    eta_base_periods: null,
    eta_pessimistic_periods: null,
  };
}

/**
 * Ищет конец волны 1: первый значимый локальный экстремум по тренду от старта.
 * Точка 0 = values[0], точка 1 = этот экстремум (не старт ряда).
 */
export function findWave1End(
  values: number[]
): { origin: { index: number; value: number }; wave1: { index: number; value: number } } | null {
  if (values.length < 2) return null;

  const origin = { index: 0, value: values[0] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Math.abs(max), Math.abs(min), 1e-9);
  const threshold = range * 0.08;

  // Направление первой волны — куда ушёл первый заметный ход
  let trend = 0;
  for (let i = 1; i < values.length; i++) {
    const move = values[i] - origin.value;
    if (Math.abs(move) >= threshold) {
      trend = Math.sign(move);
      break;
    }
  }
  if (trend === 0) {
    // Весь ряд в шуме — берём глобальный экстремум как конец W1
    let bestIdx = 0;
    for (let i = 1; i < values.length; i++) {
      if (Math.abs(values[i] - origin.value) > Math.abs(values[bestIdx] - origin.value)) {
        bestIdx = i;
      }
    }
    if (bestIdx === 0) return null;
    return { origin, wave1: { index: bestIdx, value: values[bestIdx] } };
  }

  // Первый локальный экстремум в сторону тренда после набора амплитуды
  let extremeIdx = 0;
  let extremeVal = origin.value;
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    const improved = trend > 0 ? v >= extremeVal : v <= extremeVal;
    if (improved) {
      extremeIdx = i;
      extremeVal = v;
    }

    const amp = Math.abs(extremeVal - origin.value);
    if (amp < threshold) continue;

    // Разворот: следующий бар против тренда относительно экстремума
    if (i < values.length - 1) {
      const next = values[i + 1];
      const reversing = trend > 0 ? next < extremeVal : next > extremeVal;
      if (reversing && extremeIdx > 0) {
        return { origin, wave1: { index: extremeIdx, value: extremeVal } };
      }
    }
  }

  // Импульс ещё идёт — конец W1 = текущий экстремум по тренду
  if (extremeIdx > 0 && Math.abs(extremeVal - origin.value) >= threshold) {
    return { origin, wave1: { index: extremeIdx, value: extremeVal } };
  }

  return null;
}

/**
 * Дно/вершина коррекции (волна 2): первый значимый экстремум против тренда после W1.
 */
export function findWave2End(
  values: number[],
  origin: { index: number; value: number },
  wave1: { index: number; value: number }
): { index: number; value: number } | null {
  if (wave1.index >= values.length - 1) return null;

  const amp = wave1.value - origin.value;
  const trend = Math.sign(amp) || 1;
  const absAmp = Math.abs(amp);
  if (absAmp < 1e-12) return null;

  const minRetrace = absAmp * 0.236;
  let extremeIdx = wave1.index;
  let extremeVal = wave1.value;
  let found = false;

  for (let i = wave1.index + 1; i < values.length; i++) {
    const v = values[i];
    const deeper = trend > 0 ? v <= extremeVal : v >= extremeVal;
    if (deeper) {
      extremeIdx = i;
      extremeVal = v;
      found = true;
    }

    const retraced = Math.abs(wave1.value - extremeVal);
    if (!found || retraced < minRetrace) continue;

    // Разворот обратно по тренду = коррекция локально завершена
    if (i < values.length - 1) {
      const next = values[i + 1];
      const bounce = trend > 0 ? next > extremeVal : next < extremeVal;
      if (bounce) {
        return { index: extremeIdx, value: extremeVal };
      }
    }
  }

  // Коррекция ещё идёт — фиксируем текущий экстремум против тренда, если уже заметный
  if (found && Math.abs(wave1.value - extremeVal) >= minRetrace) {
    return { index: extremeIdx, value: extremeVal };
  }

  return null;
}

/** Уровни коррекции от хода 0→1 */
export function buildCorrectionLevels(
  originValue: number,
  wave1Value: number
): FibLevel[] {
  const amp = wave1Value - originValue;
  if (Math.abs(amp) < 1e-12) return [];

  return CORRECTION_RATIOS.map((ratio) => ({
    ratio,
    value: wave1Value - amp * ratio,
  }));
}

/** Цель следующего импульса: от уровня коррекции × 1.618 амплитуды W1 */
export function impulseTargetFromCorrection(
  correctionValue: number,
  originValue: number,
  wave1Value: number,
  extension = IMPULSE_EXTENSION
): number {
  const amp = wave1Value - originValue;
  const trend = Math.sign(amp) || 1;
  return correctionValue + trend * Math.abs(amp) * extension;
}

function etaPeriods(
  fact: number,
  target: number,
  impulseAdd: number
): number | null {
  if (fact >= target) return 0;
  const remaining = target - fact;
  // Если импульсная нога не двигает факт к цели (откат / против цели) — ETA нет
  if (impulseAdd === 0) return null;
  if (Math.sign(remaining) !== Math.sign(impulseAdd)) return null;
  return Math.max(1, Math.ceil(Math.abs(remaining) / Math.abs(impulseAdd)));
}

function buildPointLabels(
  length: number,
  wave1Idx: number,
  wave2Idx: number | null
): Array<WaveLabel | null> {
  const labels: Array<WaveLabel | null> = Array(length).fill(null);
  for (let i = 0; i <= wave1Idx && i < length; i++) {
    labels[i] = WaveLabel.W1;
  }
  if (wave2Idx != null) {
    for (let i = wave1Idx + 1; i <= wave2Idx && i < length; i++) {
      labels[i] = WaveLabel.W2;
    }
    for (let i = wave2Idx + 1; i < length; i++) {
      labels[i] = WaveLabel.W3;
    }
  }
  return labels;
}

/**
 * Разметка 0→1→2: коррекция по 0.382/0.5/0.618 и следующий импульс ×1.618.
 * Точка 0 не нумеруется; W1 — на конце первой волны; W2 — на конце коррекции.
 */
export function analyzeWave(input: AnalyzeWaveInput): WaveMarkupResult {
  const values = input.values;
  const periodsAhead = 2;

  if (values.length === 0) {
    return {
      series_kind: input.series_mode,
      current_label: WaveLabel.W1,
      current_phase: WavePhase.IMPULSE,
      swings: [],
      point_labels: [],
      fib_levels: [],
      corridor: emptyCorridor(periodsAhead),
      disclaimer: WAVE_DISCLAIMER,
      origin: null,
      wave1_amplitude: 0,
    };
  }

  if (values.length === 1) {
    return {
      series_kind: input.series_mode,
      current_label: WaveLabel.W1,
      current_phase: WavePhase.IMPULSE,
      swings: [],
      point_labels: [WaveLabel.W1],
      fib_levels: [],
      corridor: emptyCorridor(periodsAhead),
      disclaimer: WAVE_DISCLAIMER,
      origin: { index: 0, value: values[0] },
      wave1_amplitude: 0,
    };
  }

  const found = findWave1End(values);
  if (!found) {
    return {
      series_kind: input.series_mode,
      current_label: WaveLabel.W1,
      current_phase: WavePhase.IMPULSE,
      swings: [],
      point_labels: values.map(() => WaveLabel.W1),
      fib_levels: [],
      corridor: emptyCorridor(periodsAhead),
      disclaimer: WAVE_DISCLAIMER,
      origin: { index: 0, value: values[0] },
      wave1_amplitude: 0,
    };
  }

  const { origin, wave1 } = found;
  const amp = wave1.value - origin.value;
  const absAmp = Math.abs(amp);
  const fib_levels = buildCorrectionLevels(origin.value, wave1.value);
  const wave2 = findWave2End(values, origin, wave1);

  const swings: WaveSwing[] = [
    { index: wave1.index, value: wave1.value, label: WaveLabel.W1 },
  ];
  if (wave2) {
    swings.push({ index: wave2.index, value: wave2.value, label: WaveLabel.W2 });
  }

  const current_label = wave2 ? WaveLabel.W2 : WaveLabel.W1;
  const current_phase = wave2 ? WavePhase.CORRECTION : WavePhase.IMPULSE;
  // Если после W2 уже пошли выше/ниже — фаза следующего импульса
  let phase = current_phase;
  let label = current_label;
  if (wave2 && wave2.index < values.length - 1) {
    const last = values[values.length - 1];
    const trend = Math.sign(amp) || 1;
    const resumed = trend > 0 ? last > wave2.value : last < wave2.value;
    if (resumed) {
      phase = WavePhase.IMPULSE;
      label = WaveLabel.W3;
    }
  }

  const scenarioPath = (ratio: number): number[] => {
    const correction = wave1.value - amp * ratio;
    const impulseFrom = (from: number) =>
      impulseTargetFromCorrection(from, origin.value, wave1.value);
    const last = values[values.length - 1];

    // Уже в следующем импульсе после W2 — тянем к цели 1.618 от дна коррекции
    if (phase === WavePhase.IMPULSE && label === WaveLabel.W3 && wave2) {
      const target = impulseFrom(wave2.value);
      return [last, target];
    }

    // В коррекции: сначала до уровня ретрейса (может быть «вниз»), затем импульс.
    // Если цена уже глубже сценария — стартуем от текущего к импульсу.
    if (phase === WavePhase.CORRECTION) {
      const trend = Math.sign(amp) || 1;
      const pastCorrection =
        trend > 0 ? last <= correction : last >= correction;
      if (pastCorrection) {
        return [last, impulseFrom(last)];
      }
      return [correction, impulseFrom(correction)];
    }

    // Волна 1 / ещё без W2 — полный сценарий коррекция → импульс
    return [correction, impulseFrom(correction)];
  };

  const optimistic = scenarioPath(0.382);
  const base = scenarioPath(0.5);
  const pessimistic = scenarioPath(0.618);

  const last = values[values.length - 1];
  const activity = recentActivityScore(values, input.series_mode);
  const damp = (path: number[]) => blendPathWithActivity(path, last, activity);

  // Прирост к факту по модулю хода импульсной ноги сценария (может быть «откат» на первой точке)
  const signedImpulseAdd = (path: number[]) => {
    if (path.length < 2) return absAmp * IMPULSE_EXTENSION * activity;
    return path[1] - path[0];
  };

  const corridor: ForecastCorridor = {
    periods_ahead: periodsAhead,
    optimistic: damp(optimistic),
    base: damp(base),
    pessimistic: damp(pessimistic),
    eta_optimistic_periods: etaPeriods(
      input.fact,
      input.target_value,
      signedImpulseAdd(damp(optimistic))
    ),
    eta_base_periods: etaPeriods(
      input.fact,
      input.target_value,
      signedImpulseAdd(damp(base))
    ),
    eta_pessimistic_periods: etaPeriods(
      input.fact,
      input.target_value,
      signedImpulseAdd(damp(pessimistic))
    ),
  };

  return {
    series_kind: input.series_mode,
    current_label: label,
    current_phase: phase,
    swings,
    point_labels: buildPointLabels(values.length, wave1.index, wave2?.index ?? null),
    fib_levels,
    corridor,
    disclaimer: WAVE_DISCLAIMER,
    origin,
    wave1_amplitude: absAmp,
  };
}
