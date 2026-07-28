import { WaveLabel, WavePhase } from './wave-markup';
import { superposeMetricPhasors, wavePhaseRadians } from './metric-phasors';

describe('metric-phasors', () => {
  it('покой: balance=1, growth=0', () => {
    const r = superposeMetricPhasors([
      { amplitude: 0, phase_rad: 0 },
      { amplitude: 0, phase_rad: Math.PI },
    ]);
    expect(r.activity).toBe(0);
    expect(r.balance).toBe(1);
    expect(r.coherence).toBe(1);
    expect(r.growth).toBe(0);
  });

  it('синхронный импульс: высокий balance и growth', () => {
    const r = superposeMetricPhasors([
      { amplitude: 1, phase_rad: 0 },
      { amplitude: 1, phase_rad: 0 },
    ]);
    expect(r.balance).toBeCloseTo(1);
    expect(r.growth).toBeCloseTo(1);
    expect(r.resultant_magnitude).toBeCloseTo(2);
  });

  it('антифаза: низкий balance при активности', () => {
    const r = superposeMetricPhasors([
      { amplitude: 1, phase_rad: 0 },
      { amplitude: 1, phase_rad: Math.PI },
    ]);
    expect(r.activity).toBeCloseTo(1);
    expect(r.balance).toBeCloseTo(0);
    expect(r.growth).toBeCloseTo(0);
  });

  it('wavePhaseRadians: импульс 0, коррекция π', () => {
    expect(wavePhaseRadians(WavePhase.IMPULSE, WaveLabel.W1)).toBe(0);
    expect(wavePhaseRadians(WavePhase.CORRECTION, WaveLabel.W2)).toBe(Math.PI);
  });
});
