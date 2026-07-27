/**
 * Проекция волнового прогноза на графики накопления и динамики.
 *
 * ---------------------------------------------------------------------------
 * Под капотом (backend `analyzeWave`): разметка 0→1→2; коридор считает
 * три ретрейса (0.382 / 0.5 / 0.618) с импульсом ×1.618 от каждого.
 *
 * UI: одна линия «Прогноз» — умеренная коррекция 0.5 → импульс ×1.618
 * (corridor.base). Края 0.382/0.618 с тем же ×1.618 почти слипаются —
 * веер не даёт читаемых «ворот», поэтому не рисуем.
 *
 * Затухание (backend): если ряд стоит — коридор уже [last,last];
 * фронт просто рисует то, что пришло.
 * ---------------------------------------------------------------------------
 *
 * RATE («новые пользователи»):
 * - Динамика: уровни Δ; провалы скорости ок.
 * - Накопление: факт₁ = факт₀ + A, факт₂ = факт₀ + A + импульсная_нога
 *   (без ложного нырка от «падения скорости»; нырок только если A < 0).
 *
 * LEVEL («пользователи всего»):
 * - Накопление: уровни A→B как есть (коррекция вниз ок).
 * - Динамика: Δ = [A − уровень_сейчас, B − A].
 *
 * Числа на оси/тултипе/в данных округляются (`roundMetric`), без float-хвостов.
 */
import type { IMetricWave } from 'app/extensions/capital/entities/ComponentMetric/model';
import { Zeus } from '@coopenomics/sdk';

export type ForecastPath = [number, number];

/** Округление для оси / тултипа / данных (без float-хвостов вроде 76.400000000001). */
export function roundMetric(v: number, digits = 2): number {
  if (!Number.isFinite(v)) return v;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export function formatMetric(v: number, digits = 2): string {
  const n = roundMetric(v, digits);
  return Number.isInteger(n) ? String(n) : String(n);
}

/**
 * Shared-tooltip Apex: не показывает ряды без значения на точке
 * (иначе «Факт: 0» / «Изменение: null» на прогнозных X).
 */
export function buildSparseTooltip(opts?: { signed?: boolean }) {
  const signed = opts?.signed ?? false;
  return ({
    series,
    dataPointIndex,
    w,
  }: {
    series: number[][];
    dataPointIndex: number;
    w: {
      globals: {
        categoryLabels?: string[];
        labels?: string[];
        seriesNames: string[];
        colors: string[];
      };
      config: { series?: Array<{ data?: Array<number | null> }> };
    };
  }) => {
    const label =
      w.globals.categoryLabels?.[dataPointIndex] ??
      w.globals.labels?.[dataPointIndex] ??
      '';
    const rows: string[] = [];

    for (let i = 0; i < series.length; i++) {
      const raw = w.config.series?.[i]?.data?.[dataPointIndex];
      if (raw === null || raw === undefined) continue;
      const v = series[i]?.[dataPointIndex];
      if (v === null || v === undefined || Number.isNaN(v)) continue;

      const name = w.globals.seriesNames[i] ?? '';
      const color = w.globals.colors[i] ?? 'var(--p-primary)';
      let text = formatMetric(v);
      if (signed && v > 0) text = `+${text}`;

      rows.push(
        `<div style="display:flex;align-items:center;gap:8px;margin-top:4px">` +
          `<span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>` +
          `<span style="color:var(--p-ink-2)">${name}</span>` +
          `<span style="margin-left:auto;font-family:var(--p-mono);color:var(--p-ink)">${text}</span>` +
          `</div>`,
      );
    }

    if (!rows.length) return '';

    return (
      `<div style="padding:8px 10px;background:var(--p-surface);border:1px solid var(--p-line);border-radius:8px;min-width:140px">` +
      `<div style="font-size:12px;color:var(--p-ink-3);margin-bottom:2px">${label}</div>` +
      rows.join('') +
      `</div>`
    );
  };
}

export function isLevelSeriesMode(
  seriesMode: Zeus.ModelTypes['MetricSeriesMode'] | undefined,
  wave?: IMetricWave | null,
): boolean {
  return (
    wave?.series_mode === Zeus.MetricSeriesMode.LEVEL ||
    seriesMode === Zeus.MetricSeriesMode.LEVEL
  );
}

/**
 * Один сценарий для UI: коррекция 0.5 → импульс 1.618 (corridor.base).
 */
export function scenarioPathsFromWave(wave: IMetricWave | null | undefined): {
  label: string;
  path: ForecastPath;
}[] {
  const raw = wave?.corridor?.base;
  if (!Array.isArray(raw) || raw.length < 2) return [];
  return [
    {
      label: 'Прогноз',
      path: [roundMetric(raw[0]), roundMetric(raw[1])],
    },
  ];
}

/**
 * Прогноз на график накопления (две будущие точки после факта).
 */
export function projectAccumulationPath(
  path: ForecastPath,
  lastFact: number,
  opts: { levelMode: boolean },
): ForecastPath {
  if (opts.levelMode) {
    return [roundMetric(path[0]), roundMetric(path[1])];
  }
  const [a, b] = path;
  const impulseLeg = b - a;
  return [
    roundMetric(lastFact + a),
    roundMetric(lastFact + a + impulseLeg),
  ];
}

/**
 * Прогноз на график динамики (две будущие точки ряда Δ).
 */
export function projectDynamicsPath(
  path: ForecastPath,
  lastLevel: number,
  opts: { levelMode: boolean },
): ForecastPath {
  if (!opts.levelMode) {
    return [roundMetric(path[0]), roundMetric(path[1])];
  }
  const [a, b] = path;
  return [roundMetric(a - lastLevel), roundMetric(b - a)];
}

/** Дополняет историю двумя точками прогноза (стык с последним фактом). */
export function padForecastSeries(
  hist: Array<number | null>,
  path: ForecastPath,
): Array<number | null> {
  const n = hist.length;
  const out: Array<number | null> = Array(n + 2).fill(null);
  for (let i = 0; i < n; i++) {
    const v = hist[i];
    out[i] = v == null ? null : roundMetric(v);
  }
  if (n > 0 && hist[n - 1] != null) out[n - 1] = roundMetric(hist[n - 1] as number);
  out[n] = path[0];
  out[n + 1] = path[1];
  return out;
}
