/**
 * Фазоры метрик для резонанса (когерентный рост).
 *
 * Импульс → φ=0 (ось роста), коррекция → φ=π.
 * S = Σ A·e^(iφ). Покой (ΣA≈0): balance=1, growth=0.
 * При движении balance = |S|/ΣA; growth = max(0, Re(S))/ΣA.
 */
import { WaveLabel, WavePhase } from './wave-markup';

export interface MetricPhasorInput {
  amplitude: number;
  phase_rad: number;
}

export interface MetricPhasorSuperposition {
  /** Средняя амплитуда движения [0..1]; 0 = покой */
  activity: number;
  /** |S| / ΣA; в покое 1 */
  coherence: number;
  /** Физичный баланс процесса (= coherence) */
  balance: number;
  /** Доля энергии на оси импульса; в покое 0 */
  growth: number;
  resultant_re: number;
  resultant_im: number;
  resultant_magnitude: number;
  resultant_angle: number;
}

/** Фаза цикла: импульс к цели = 0, коррекция = π. */
export function wavePhaseRadians(phase: WavePhase, label: WaveLabel): number {
  if (phase === WavePhase.CORRECTION || label === WaveLabel.W2) {
    return Math.PI;
  }
  return 0;
}

export function superposeMetricPhasors(
  items: MetricPhasorInput[]
): MetricPhasorSuperposition {
  const sumA = items.reduce((s, i) => s + Math.max(0, i.amplitude), 0);
  let re = 0;
  let im = 0;
  for (const item of items) {
    const a = Math.max(0, item.amplitude);
    re += a * Math.cos(item.phase_rad);
    im += a * Math.sin(item.phase_rad);
  }
  const magnitude = Math.hypot(re, im);
  const activity = items.length ? sumA / items.length : 0;
  const coherence = sumA < 1e-9 ? 1 : Math.min(1, magnitude / sumA);
  const balance = coherence;
  const growth = sumA < 1e-9 ? 0 : Math.max(0, re) / sumA;

  return {
    activity,
    coherence,
    balance,
    growth,
    resultant_re: re,
    resultant_im: im,
    resultant_magnitude: magnitude,
    resultant_angle: Math.atan2(im, re),
  };
}
