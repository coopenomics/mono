import {
  analyzeWave,
  detectSwings,
  buildFibLevels,
  WaveLabel,
  WavePhase,
  WAVE_DISCLAIMER,
} from './wave-markup';
import { MetricSeriesMode } from '../enums/metric-series-mode.enum';

describe('wave-markup (562-34 stage 3)', () => {
  it('с одной точки даёт W1 и дисклеймер', () => {
    const result = analyzeWave({
      values: [3],
      series_mode: MetricSeriesMode.RATE,
      fact: 3,
      target_value: 30,
    });

    expect(result.current_label).toBe(WaveLabel.W1);
    expect(result.current_phase).toBe(WavePhase.IMPULSE);
    expect(result.disclaimer).toBe(WAVE_DISCLAIMER);
    expect(result.corridor.base.length).toBe(8);
    expect(result.corridor.eta_base_periods).not.toBeNull();
  });

  it('размечает импульс 1-2-3 на колебательном ряде скорости', () => {
    // подъём → коррекция → сильный подъём
    const values = [1, 4, 5, 2, 1, 6, 9, 10];
    const swings = detectSwings(values);
    expect(swings.length).toBeGreaterThanOrEqual(3);

    const result = analyzeWave({
      values,
      series_mode: MetricSeriesMode.RATE,
      fact: values.reduce((a, b) => a + b, 0),
      target_value: 100,
    });

    expect(result.swings[0].label).toBe(WaveLabel.W1);
    expect(result.swings.map((s) => s.label).slice(0, 3)).toEqual([
      WaveLabel.W1,
      WaveLabel.W2,
      WaveLabel.W3,
    ]);
    expect(result.fib_levels.length).toBeGreaterThan(0);
  });

  it('строит Фибо-уровни от базы импульса', () => {
    const swings = [
      { index: 0, value: 0, label: WaveLabel.W1 },
      { index: 2, value: 10, label: WaveLabel.W2 },
      { index: 4, value: 6, label: WaveLabel.W3 },
    ];
    const levels = buildFibLevels(swings);
    const r618 = levels.find((l) => l.ratio === 0.618);
    // база W1=0 → крайний свинг=6 → 0.618 * 6
    expect(r618?.value).toBeCloseTo(3.708, 5);
  });

  it('для level-режима ETA смотрит на прогноз уровня', () => {
    const result = analyzeWave({
      values: [10, 12, 11, 15],
      series_mode: MetricSeriesMode.LEVEL,
      fact: 15,
      target_value: 40,
      periods_ahead: 5,
    });

    expect(result.series_kind).toBe(MetricSeriesMode.LEVEL);
    expect(result.corridor.eta_optimistic_periods).not.toBeNull();
  });
});
