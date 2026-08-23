/**
 * Полярная мишень резонанса: ширина + радиус + радиальный градиент.
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

/** Минимальный угол сектора для подписи внутри среза (~32°). */
export const SECTOR_LABEL_MIN_SWEEP = (32 * Math.PI) / 180;

/** Ниже этого угла — подпись вдоль биссектрисы; выше — горизонтально. */
const SECTOR_LABEL_ANGLE_SWEEP = (70 * Math.PI) / 180;

export interface SectorLabelLayout {
  x: number;
  y: number;
  text: string;
  /** Градусы SVG `rotate` вокруг (x, y). */
  rotate: number;
}

export function truncateSectorTitle(title: string, maxChars: number): string {
  const t = title.trim().replace(/\s+/g, ' ');
  if (!t || maxChars < 1) return '';
  if (t.length <= maxChars) return t;
  if (maxChars === 1) return '…';
  return `${t.slice(0, maxChars - 1)}…`;
}

/** Угол точки в системе мишени: 0 сверху, по часовой. */
function pointAngle(cx: number, cy: number, x: number, y: number): number {
  let a = Math.atan2(x - cx, cy - y);
  if (a < 0) a += TWO_PI;
  return a;
}

function angleInSweep(a: number, start: number, end: number): boolean {
  // Секторы без wrap (start < end); допуск на границе
  return a >= start - 1e-6 && a <= end + 1e-6;
}

/**
 * Горизонтальный пролёт внутри клина на высоте labelY (через бинарный поиск).
 * Хорда по радиусу завышает ширину для боковых секторов — поэтому так.
 */
function horizontalSpanInSector(
  cx: number,
  cy: number,
  startAngle: number,
  endAngle: number,
  outerR: number,
  coreR: number,
  px: number,
  py: number,
): number {
  // Запас от обода/ядра и от радиальных рёбер клина
  const padR = 7;
  const padAng = 0.07; // ~4°
  const a0 = startAngle + padAng;
  const a1 = endAngle - padAng;
  if (a1 <= a0) return 0;

  const isInside = (x: number): boolean => {
    const dist = Math.hypot(x - cx, py - cy);
    if (dist < coreR + padR || dist > outerR - padR) return false;
    return angleInSweep(pointAngle(cx, cy, x, py), a0, a1);
  };

  if (!isInside(px)) return 0;

  const expand = (dir: -1 | 1): number => {
    let lo = 0;
    let hi = outerR;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (isInside(px + dir * mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  return expand(-1) + expand(1);
}

/** Примерная ширина глифа для `--p-fs-eyebrow` (кириллица + stroke). */
const LABEL_CHAR_PX = 7.6;

/**
 * Подпись внутри среза: только если сектор достаточно широкий.
 * Узкие клинья — без текста (имя в тултипе).
 */
export function layoutSectorLabel(
  sector: Pick<PolarSector, 'title' | 'startAngle' | 'endAngle' | 'radius'>,
  opts: { cx: number; cy: number; coreR: number },
): SectorLabelLayout | null {
  const sweep = sector.endAngle - sector.startAngle;
  if (sweep < SECTOR_LABEL_MIN_SWEEP) return null;

  const mid = (sector.startAngle + sector.endAngle) / 2;
  const outer = Math.max(sector.radius, opts.coreR + 1);
  const r = opts.coreR + (outer - opts.coreR) * 0.55;
  const { x, y } = pointOnCircle(opts.cx, opts.cy, r, mid);

  const angled = sweep < SECTOR_LABEL_ANGLE_SWEEP;
  let availPx: number;
  if (angled) {
    // Текст вдоль биссектрисы ≈ по касательной: хорда с запасом
    availPx = 2 * r * Math.sin(sweep / 2) * 0.52;
  } else {
    // Горизонтальный текст: реальная ширина клина на этой высоте + запас от краёв
    availPx =
      horizontalSpanInSector(
        opts.cx,
        opts.cy,
        sector.startAngle,
        sector.endAngle,
        outer,
        opts.coreR,
        x,
        y,
      ) * 0.72;
  }

  const maxChars = Math.max(3, Math.min(20, Math.floor(availPx / LABEL_CHAR_PX)));
  const text = truncateSectorTitle(sector.title, maxChars);
  if (!text) return null;

  let rotate = 0;
  if (angled) {
    let deg = (mid * 180) / Math.PI;
    if (mid > Math.PI / 2 && mid < (3 * Math.PI) / 2) {
      deg += 180;
    }
    rotate = deg;
  }

  return { x, y, text, rotate };
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
