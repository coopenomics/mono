<template lang="pug">
.metric-series
  .metric-series__toolbar
    BaseSelect(
      v-model='period',
      :options='periodOptions',
      label='Период'
    )
    .metric-series__manual
      BaseInput(
        v-model='manualDelta',
        type='number',
        label='Ручной вклад'
      )
      BaseButton(
        variant='secondary',
        size='sm',
        :loading='isLogging',
        @click='logContribution'
      ) Записать

  .metric-series__dashboard(v-if='series && series.points.length')
    .metric-series__card
      .metric-series__card-head
        .metric-series__label Накопление
        .metric-series__hint Факт к цели по периодам
      svg.metric-series__svg(
        :viewBox='`0 0 ${svgW} ${svgH}`',
        preserveAspectRatio='none'
      )
        line.metric-series__target(
          :x1='pad',
          :y1='yOf(series.target_value)',
          :x2='svgW - pad',
          :y2='yOf(series.target_value)'
        )
        polyline.metric-series__ideal(
          v-if='idealPoints',
          :points='idealPoints'
        )
        polyline.metric-series__cum(
          :points='cumPoints'
        )
      .metric-series__legend
        span.metric-series__leg.metric-series__leg--fact Факт
        span.metric-series__leg.metric-series__leg--ideal(v-if='hasIdeal') План
        span.metric-series__leg.metric-series__leg--target Цель {{ series.target_value }}

    .metric-series__card
      MetricWavePanel(
        :metric-hash='metricHash',
        :period='period',
        :deltas='series.points.map((p) => p.delta)'
      )

  .metric-series__empty(v-else-if='!isLoading')
    EmptyState(title='Пока нет точек ряда — закройте задачу с привязкой или внесите ручной вклад')
      template(#icon)
        q-icon(name='timeline', size='28px')

  .metric-series__skel(v-if='isLoading')
    .skel
    .skel
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { BaseButton, BaseInput, BaseSelect, EmptyState } from 'src/shared/ui/base';
import { useMetricSeries } from '../model';
import MetricWavePanel from './MetricWavePanel.vue';

const props = defineProps<{
  metricHash: string;
}>();

const emit = defineEmits<{
  updated: [];
}>();

const metricHashRef = toRef(props, 'metricHash');
const {
  series,
  isLoading,
  isLogging,
  period,
  manualDelta,
  logContribution,
} = useMetricSeries(() => metricHashRef.value, () => emit('updated'));

const periodOptions = [
  { label: 'День', value: Zeus.MetricSeriesPeriod.DAY },
  { label: 'Неделя', value: Zeus.MetricSeriesPeriod.WEEK },
  { label: 'Месяц', value: Zeus.MetricSeriesPeriod.MONTH },
];

const svgW = 320;
const svgH = 192;
const pad = 10;

const yMax = computed(() => {
  const s = series.value;
  if (!s?.points.length) return 1;
  const vals = s.points.flatMap((p) => [
    p.cumulative,
    p.ideal_cumulative ?? 0,
    s.target_value,
  ]);
  const max = Math.max(...vals, 1);
  return max * 1.05;
});

const yOf = (v: number) => {
  const max = yMax.value || 1;
  return svgH - pad - ((Math.max(v, 0) / max) * (svgH - pad * 2));
};

const xOf = (i: number, n: number) => {
  if (n <= 1) return svgW / 2;
  return pad + (i / (n - 1)) * (svgW - pad * 2);
};

const cumPoints = computed(() => {
  const s = series.value;
  if (!s?.points.length) return '';
  return s.points
    .map((p, i) => `${xOf(i, s.points.length)},${yOf(p.cumulative)}`)
    .join(' ');
});

const hasIdeal = computed(() =>
  !!series.value?.points.some((p) => p.ideal_cumulative != null),
);

const idealPoints = computed(() => {
  const s = series.value;
  if (!s?.points.length || !hasIdeal.value) return '';
  return s.points
    .map((p, i) => `${xOf(i, s.points.length)},${yOf(p.ideal_cumulative ?? 0)}`)
    .join(' ');
});
</script>

<style lang="scss" scoped>
.metric-series {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding-top: var(--p-2);
  border-top: 1px solid var(--p-line);
  margin-top: var(--p-2);
}

.metric-series__toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: var(--p-2);
  align-items: end;
}

.metric-series__manual {
  display: flex;
  gap: var(--p-2);
  align-items: end;
}

.metric-series__dashboard {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--p-3);
}

@media (max-width: 720px) {
  .metric-series__dashboard {
    grid-template-columns: 1fr;
  }
}

.metric-series__card {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  min-width: 0;
}

.metric-series__card-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-series__label {
  font-size: var(--p-fs-caption);
  color: var(--p-ink);
  font-weight: 600;
}

.metric-series__hint {
  font-size: var(--p-fs-caption);
  color: var(--p-ink-3);
}

.metric-series__svg {
  width: 100%;
  height: 192px;
  background: var(--p-surface-2);
  border-radius: var(--p-r-sm);
}

.metric-series__cum {
  fill: none;
  stroke: var(--p-primary);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.metric-series__ideal {
  fill: none;
  stroke: var(--p-ink-3);
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
}

.metric-series__target {
  stroke: var(--p-warn);
  stroke-width: 1;
  stroke-dasharray: 2 2;
}

.metric-series__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2) var(--p-3);
  font-size: var(--p-fs-caption);
  color: var(--p-ink-3);
}

.metric-series__leg::before {
  content: '';
  display: inline-block;
  width: 10px;
  height: 2px;
  margin-right: var(--p-1);
  vertical-align: middle;
  background: currentColor;
}

.metric-series__leg--fact::before {
  background: var(--p-primary);
}

.metric-series__leg--ideal::before {
  background: var(--p-ink-3);
}

.metric-series__leg--target::before {
  background: var(--p-warn);
}

.metric-series__empty {
  padding: var(--p-2) 0;
}

.metric-series__skel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--p-3);
}

.metric-series__skel .skel {
  height: 192px;
  border-radius: var(--p-r-sm);
  background: var(--p-surface-2);
}
</style>
