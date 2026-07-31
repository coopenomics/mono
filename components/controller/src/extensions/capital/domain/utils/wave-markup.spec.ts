import {
  analyzeWave,
  findWave1End,
  findWave2End,
  buildCorrectionLevels,
  impulseTargetFromCorrection,
  WaveLabel,
  WavePhase,
  WAVE_DISCLAIMER,
  IMPULSE_EXTENSION,
} from './wave-markup';
import { MetricSeriesMode } from '../enums/metric-series-mode.enum';

describe('wave-markup (0→1→2 + fib scenarios)', () => {
  it('с одной точки — импульс без свингов W1 на старте', () => {
    const result = analyzeWave({
      values: [3],
      series_mode: MetricSeriesMode.RATE,
      fact: 3,
      target_value: 30,
    });

    expect(result.current_label).toBe(WaveLabel.W1);
    expect(result.current_phase).toBe(WavePhase.IMPULSE);
    expect(result.swings).toHaveLength(0);
    expect(result.disclaimer).toBe(WAVE_DISCLAIMER);
  });

  it('волна 1 заканчивается на первом максимуме, не на старте', () => {
    // старт 0 → рост до 10 → коррекция до 4
    const values = [0, 3, 7, 10, 8, 5, 4];
    const found = findWave1End(values);
    expect(found).not.toBeNull();
    expect(found!.origin.index).toBe(0);
    expect(found!.wave1.index).toBe(3);
    expect(found!.wave1.value).toBe(10);

    const w2 = findWave2End(values, found!.origin, found!.wave1);
    expect(w2).not.toBeNull();
    expect(w2!.value).toBe(4);

    // Календарные нули/плато — часть ряда; индексы на полном массиве
    const result = analyzeWave({
      values,
      series_mode: MetricSeriesMode.RATE,
      fact: 20,
      target_value: 100,
    });

    expect(result.swings[0]).toMatchObject({
      index: 3,
      value: 10,
      label: WaveLabel.W1,
    });
    expect(result.swings[1]?.label).toBe(WaveLabel.W2);
    expect(result.fib_levels.map((l) => l.ratio)).toEqual([0.382, 0.5, 0.618]);
  });

  it('RATE: нули после вклада учитываются как откат (коррекция)', () => {
    const result = analyzeWave({
      values: [0, 0, 0, 6, 0, 0, 0],
      series_mode: MetricSeriesMode.RATE,
      fact: 6,
      target_value: 100,
    });
    expect(result.current_phase).toBe(WavePhase.CORRECTION);
    expect(result.current_label).toBe(WaveLabel.W2);
  });

  it('RATE: один вклад после нулей — есть коридор прогноза (не пустой)', () => {
    const result = analyzeWave({
      values: [0, 0, 0, 0, 0, 0, 6],
      series_mode: MetricSeriesMode.RATE,
      fact: 6,
      target_value: 100,
    });
    expect(result.current_phase).toBe(WavePhase.IMPULSE);
    expect(result.current_label).toBe(WaveLabel.W1);
    expect(result.corridor.base).toHaveLength(2);
    expect(result.corridor.optimistic).toHaveLength(2);
  });

  it('RATE: спад скорости — коррекция', () => {
    const result = analyzeWave({
      values: [2, 5, 10, 4, 2],
      series_mode: MetricSeriesMode.RATE,
      fact: 23,
      target_value: 100,
    });
    expect(result.current_phase).toBe(WavePhase.CORRECTION);
    expect(result.current_label).toBe(WaveLabel.W2);
  });

  it('RATE: долгий застой после вклада — прогноз схлопнут к последнему Δ (=0)', () => {
    const result = analyzeWave({
      values: [6, 0, 0, 0, 0, 0],
      series_mode: MetricSeriesMode.RATE,
      fact: 6,
      target_value: 100,
    });
    expect(result.corridor.base[0]).toBeCloseTo(0, 5);
    expect(result.corridor.base[1]).toBeCloseTo(0, 5);
  });

  it('уровни коррекции 0.382/0.5/0.618 от хода 0→1', () => {
    const levels = buildCorrectionLevels(0, 10);
    expect(levels.find((l) => l.ratio === 0.382)?.value).toBeCloseTo(6.18, 5);
    expect(levels.find((l) => l.ratio === 0.5)?.value).toBeCloseTo(5, 5);
    expect(levels.find((l) => l.ratio === 0.618)?.value).toBeCloseTo(3.82, 5);
  });

  it('импульс от коррекции = C + 1.618 × амплитуда W1', () => {
    const target = impulseTargetFromCorrection(5, 0, 10);
    expect(target).toBeCloseTo(5 + 10 * IMPULSE_EXTENSION, 5);
  });

  it('коридор — три сценария [коррекция, импульс]', () => {
    const result = analyzeWave({
      values: [0, 2, 5, 10, 7],
      series_mode: MetricSeriesMode.LEVEL,
      fact: 7,
      target_value: 40,
    });

    expect(result.corridor.optimistic).toHaveLength(2);
    expect(result.corridor.base).toHaveLength(2);
    expect(result.corridor.pessimistic).toHaveLength(2);
    // мелкая коррекция выше глубокой (восходящий тренд)
    expect(result.corridor.optimistic[0]).toBeGreaterThan(result.corridor.pessimistic[0]);
    expect(result.corridor.eta_base_periods).not.toBeNull();
  });

  it('при застое LEVEL прогноз плоский на последнем факте', () => {
    // рывок был, потом несколько периодов без движения
    const values = [0, 0, 20, 20, 20, 20, 20];
    const result = analyzeWave({
      values,
      series_mode: MetricSeriesMode.LEVEL,
      fact: 20,
      target_value: 65,
    });
    const last = 20;
    expect(result.corridor.base[0]).toBeCloseTo(last, 5);
    expect(result.corridor.base[1]).toBeCloseTo(last, 5);
  });

  it('при свежем движении LEVEL коридор не плоский', () => {
    const values = [0, 0, 0, 0, 20];
    const result = analyzeWave({
      values,
      series_mode: MetricSeriesMode.LEVEL,
      fact: 20,
      target_value: 65,
    });
    expect(result.corridor.base[0]).not.toBeCloseTo(20, 1);
  });
});
