/**
 * Полярная мишень суперпозиции: ширина + радиус + радиальный градиент.
 * Цвета адаптируются к light/dark.
 */

export interface PolarMetricInput {
  metric_hash: string;
  title: string;
  amplitude: number;
  phase_rad: number;
}

export interface PolarSector {
  key: string;
  title: string;
  amplitude: number;
  phase_rad: number;
  share: number;
  startAngle: number;
  endAngle: number;
  radius: number;
  path: string;
  fill: string;
  gradientId: string;
  stopInner: string;
  stopMid: string;
  stopOuter: string;
  isCorrection: boolean;
}

const EPS = 0.08;
const TWO_PI = Math.PI * 2;

/**
 * Единый показатель резонанса [0..1].
 * Цель: рост ≥ 0, движение > 0, баланс → 100%.
 * Геометрическое среднее — если нет движения или роста, резонанс 0.
 */
export function superpositionScore(
  balance: number,
  growth: number,
  activity: number,
): number {
  const b = Math.max(0, Math.min(1, balance));
  const g = Math.max(0, Math.min(1, growth));
  const a = Math.max(0, Math.min(1, activity));
  return Math.cbrt(b * g * a);
}

/** Палитра фазы: импульс = зелёный, коррекция = красный. t — сила к центру. */
export function phaseHeatColor(
  t: number,
  dark: boolean,
  correction: boolean,
): string {
  const x = Math.max(0, Math.min(1, t));
  if (correction) {
    if (dark) {
      // уголь → мягкий красный
      const r = Math.round(68 + x * 130);
      const g = Math.round(48 + x * 28);
      const b = Math.round(52 + x * 40);
      return `rgb(${r}, ${g}, ${b})`;
    }
    // светлый серо-розовый → пыльный красный
    const r = Math.round(236 - x * 40);
    const g = Math.round(220 - x * 130);
    const b = Math.round(222 - x * 120);
    return `rgb(${r}, ${g}, ${b})`;
  }
  // импульс / рост
  if (dark) {
    // уголь → мягкий зелёный
    const r = Math.round(48 + x * 30);
    const g = Math.round(68 + x * 110);
    const b = Math.round(58 + x * 55);
    return `rgb(${r}, ${g}, ${b})`;
  }
  // светлый серо-зелёный → пыльный зелёный
  const r = Math.round(220 - x * 120);
  const g = Math.round(232 - x * 40);
  const b = Math.round(224 - x * 100);
  return `rgb(${r}, ${g}, ${b})`;
}

/** @deprecated alias — центр без фазы считаем импульсом/нейтральным ростом */
export function softHeatColor(t: number, dark: boolean): string {
  return phaseHeatColor(t, dark, false);
}

export function sectorHeatStops(
  glow: number,
  amplitude: number,
  dark: boolean,
  correction: boolean,
): { inner: string; mid: string; outer: string } {
  const amp = Math.max(0, Math.min(1, amplitude));
  const g = Math.max(0, Math.min(1, glow));
  const innerT = Math.min(1, g * 0.55 + amp * 0.55);
  const midT = Math.min(1, g * 0.35 + amp * 0.28);
  const outerFloor = dark ? 0.12 : 0.08;
  const outerT = Math.min(1, Math.max(outerFloor, g * 0.12 + amp * 0.08));
  return {
    inner: phaseHeatColor(innerT, dark, correction),
    mid: phaseHeatColor(midT, dark, correction),
    outer: phaseHeatColor(outerT, dark, correction),
  };
}

function isCorrectionPhase(phaseRad: number): boolean {
  const phase = ((phaseRad % TWO_PI) + TWO_PI) % TWO_PI;
  return Math.abs(phase - Math.PI) < 0.35;
}

function pointOnCircle(
  cx: number,
  cy: number,
  r: number,
  angle: number,
): { x: number; y: number } {
  return {
    x: cx + r * Math.sin(angle),
    y: cy - r * Math.cos(angle),
  };
}

export function sectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  if (sweep <= 1e-6 || outerR <= innerR) {
    return '';
  }

  if (sweep >= TWO_PI - 1e-6) {
    return [
      `M ${cx} ${cy - outerR}`,
      `A ${outerR} ${outerR} 0 1 1 ${cx} ${cy + outerR}`,
      `A ${outerR} ${outerR} 0 1 1 ${cx} ${cy - outerR}`,
      `M ${cx} ${cy - innerR}`,
      `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy + innerR}`,
      `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR}`,
      'Z',
    ].join(' ');
  }

  const large = sweep > Math.PI ? 1 : 0;
  const o0 = pointOnCircle(cx, cy, outerR, startAngle);
  const o1 = pointOnCircle(cx, cy, outerR, endAngle);
  const i1 = pointOnCircle(cx, cy, innerR, endAngle);
  const i0 = pointOnCircle(cx, cy, innerR, startAngle);

  if (innerR < 0.5) {
    return [
      `M ${cx} ${cy}`,
      `L ${o0.x} ${o0.y}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${o1.x} ${o1.y}`,
      'Z',
    ].join(' ');
  }

  return [
    `M ${o0.x} ${o0.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i0.x} ${i0.y}`,
    'Z',
  ].join(' ');
}

export function buildPolarSectors(
  items: PolarMetricInput[],
  opts: {
    cx: number;
    cy: number;
    maxR: number;
    innerR: number;
    growth: number;
    activity: number;
    dark: boolean;
  },
): PolarSector[] {
  if (!items.length) return [];

  const sorted = [...items].sort((a, b) =>
    a.title.localeCompare(b.title, 'ru'),
  );

  const weights = sorted.map((i) => Math.max(i.amplitude, EPS));
  const sumW = weights.reduce((s, w) => s + w, 0);
  const glow = Math.max(0, Math.min(1, opts.growth * 0.7 + opts.activity * 0.3));

  let angle = 0;
  return sorted.map((item, idx) => {
    const share = weights[idx] / sumW;
    const startAngle = angle;
    const endAngle = angle + share * TWO_PI;
    angle = endAngle;

    const amp = Math.max(0, Math.min(1, item.amplitude));
    const idleFloor = opts.activity < 0.05 ? 0.72 : 0.28;
    const radius =
      opts.innerR + (opts.maxR - opts.innerR) * (idleFloor + amp * (1 - idleFloor));

    const correction = isCorrectionPhase(item.phase_rad);
    const stops = sectorHeatStops(glow, amp, opts.dark, correction);
    const gradientId = `sp-grad-${item.metric_hash.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    return {
      key: item.metric_hash,
      title: item.title,
      amplitude: item.amplitude,
      phase_rad: item.phase_rad,
      share,
      startAngle,
      endAngle,
      radius,
      path: sectorPath(opts.cx, opts.cy, 0, radius, startAngle, endAngle),
      fill: `url(#${gradientId})`,
      gradientId,
      stopInner: stops.inner,
      stopMid: stops.mid,
      stopOuter: stops.outer,
      isCorrection: correction,
    };
  });
}
