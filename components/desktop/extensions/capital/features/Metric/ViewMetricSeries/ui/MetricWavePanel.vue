<template lang="pug">
.metric-wave(v-if='wave')
  .metric-wave__head
    .metric-wave__phase
      span.metric-wave__badge Волна {{ wave.current_label }}
      span.metric-wave__phase-label {{ phaseLabel }}
    .metric-wave__eta(v-if='wave.corridor.eta_base_periods != null')
      span.t-mono ~{{ wave.corridor.eta_base_periods }}
      span.metric-wave__eta-unit периодов до цели (база)

  svg.metric-wave__svg(
    :viewBox='`0 0 ${svgW} ${svgH}`',
    preserveAspectRatio='none'
  )
    //- Фибо-уровни
    line.metric-wave__fib(
      v-for='(lvl, i) in wave.fib_levels',
      :key='"fib-" + i',
      :x1='pad',
      :y1='yOf(lvl.value)',
      :x2='svgW - pad',
      :y2='yOf(lvl.value)'
    )
    //- Коридор (база + опт/песс как заливка через polyline pair — упрощённо линии)
    polyline.metric-wave__corridor-opt(:points='corridorPoints(wave.corridor.optimistic)')
    polyline.metric-wave__corridor-pess(:points='corridorPoints(wave.corridor.pessimistic)')
    polyline.metric-wave__corridor-base(:points='corridorPoints(wave.corridor.base)')
    //- Факт ряда
    polyline.metric-wave__series(:points='seriesPoints')
    //- Свинги
    circle.metric-wave__swing(
      v-for='s in wave.swings',
      :key='"sw-" + s.index',
      :cx='xOf(s.index, wave.values.length)',
      :cy='yOf(s.value)',
      r='3'
    )
    text.metric-wave__swing-label(
      v-for='s in wave.swings',
      :key='"lb-" + s.index',
      :x='xOf(s.index, wave.values.length)',
      :y='yOf(s.value) - 6'
    ) {{ s.label }}

  .metric-wave__disclaimer
    q-icon(name='info', size='14px')
    span {{ wave.disclaimer }}
</template>

<script setup lang="ts">
import { computed, watch, ref, toRef } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { api } from 'app/extensions/capital/entities/ComponentMetric/api';
import type { IMetricWave } from 'app/extensions/capital/entities/ComponentMetric/model';
import { FailAlert } from 'src/shared/api';

const props = defineProps<{
  metricHash: string;
  period: Zeus.ModelTypes['MetricSeriesPeriod'];
}>();

const metricHashRef = toRef(props, 'metricHash');
const periodRef = toRef(props, 'period');
const wave = ref<IMetricWave | null>(null);

const svgW = 320;
const svgH = 120;
const pad = 10;

const phaseLabel = computed(() => {
  if (!wave.value) return '';
  return wave.value.current_phase === Zeus.WavePhase.IMPULSE ? 'импульс' : 'коррекция';
});

const allY = computed(() => {
  const w = wave.value;
  if (!w) return [0, 1];
  const vals = [
    ...w.values,
    ...w.fib_levels.map((l) => l.value),
    ...w.corridor.optimistic,
    ...w.corridor.base,
    ...w.corridor.pessimistic,
  ];
  const min = Math.min(...vals, 0);
  const max = Math.max(...vals, 1);
  return [min, max === min ? max + 1 : max];
});

const yOf = (v: number) => {
  const [min, max] = allY.value;
  const t = (v - min) / (max - min);
  return svgH - pad - t * (svgH - pad * 2);
};

const xOf = (i: number, n: number) => {
  if (n <= 1) return svgW / 2;
  return pad + (i / (n - 1)) * (svgW - pad * 2);
};

const seriesPoints = computed(() => {
  const w = wave.value;
  if (!w?.values.length) return '';
  return w.values.map((v, i) => `${xOf(i, w.values.length)},${yOf(v)}`).join(' ');
});

const corridorPoints = (projected: number[]) => {
  const w = wave.value;
  if (!w?.values.length || !projected.length) return '';
  const nHist = w.values.length;
  const nAll = nHist + projected.length;
  // коридор начинается от последней фактической точки
  const last = w.values[nHist - 1];
  const pts = [`${xOf(nHist - 1, nAll)},${yOf(last)}`];
  projected.forEach((v, i) => {
    pts.push(`${xOf(nHist + i, nAll)},${yOf(v)}`);
  });
  return pts.join(' ');
};

const loadWave = async () => {
  if (!metricHashRef.value) return;
  try {
    wave.value = await api.getMetricWave({
      metric_hash: metricHashRef.value,
      period: periodRef.value,
    });
  } catch (error) {
    FailAlert(error);
  }
};

watch(
  () => [metricHashRef.value, periodRef.value] as const,
  () => {
    void loadWave();
  },
  { immediate: true },
);

defineExpose({ reload: loadWave });
</script>

<style lang="scss" scoped>
.metric-wave {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  margin-top: var(--p-2);
}

.metric-wave__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2);
  flex-wrap: wrap;
}

.metric-wave__phase {
  display: flex;
  align-items: center;
  gap: var(--p-2);
}

.metric-wave__badge {
  font-size: var(--p-fs-caption);
  font-weight: 600;
  color: var(--p-primary);
  background: var(--p-primary-soft);
  padding: 2px var(--p-2);
  border-radius: var(--p-r-sm);
}

.metric-wave__phase-label {
  font-size: var(--p-fs-caption);
  color: var(--p-ink-2);
}

.metric-wave__eta {
  display: flex;
  align-items: baseline;
  gap: var(--p-1);
  font-size: var(--p-fs-caption);
  color: var(--p-ink-2);
}

.metric-wave__eta-unit {
  color: var(--p-ink-3);
}

.metric-wave__svg {
  width: 100%;
  height: 120px;
  background: var(--p-surface-2);
  border-radius: var(--p-r-sm);
}

.metric-wave__series {
  fill: none;
  stroke: var(--p-primary);
  stroke-width: 2;
  stroke-linejoin: round;
}

.metric-wave__corridor-base {
  fill: none;
  stroke: var(--p-ink-2);
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
}

.metric-wave__corridor-opt {
  fill: none;
  stroke: var(--p-pos);
  stroke-width: 1;
  opacity: 0.55;
}

.metric-wave__corridor-pess {
  fill: none;
  stroke: var(--p-neg);
  stroke-width: 1;
  opacity: 0.45;
}

.metric-wave__fib {
  stroke: var(--p-line-2);
  stroke-width: 1;
  stroke-dasharray: 2 3;
  opacity: 0.7;
}

.metric-wave__swing {
  fill: var(--p-primary);
}

.metric-wave__swing-label {
  fill: var(--p-ink-2);
  font-size: 9px;
  text-anchor: middle;
  font-family: var(--p-mono);
}

.metric-wave__disclaimer {
  display: flex;
  align-items: flex-start;
  gap: var(--p-1);
  font-size: var(--p-fs-caption);
  color: var(--p-ink-3);
  line-height: 1.35;
}
</style>
