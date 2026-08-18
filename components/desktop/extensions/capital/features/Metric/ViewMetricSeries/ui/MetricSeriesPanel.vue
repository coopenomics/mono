<template lang="pug">
.metric-series
  .metric-series__view(v-if='series && series.points.length')
    .metric-series__chart(v-show='chartMode === "accumulation"')
      ClientOnly
        template(#default)
          component.metric-series__apex(
            :is='ApexChart',
            type='line',
            height='240',
            :options='accumulationOptions',
            :series='accumulationSeries'
          )
        template(#fallback)
          .metric-series__skel-chart

    .metric-series__chart(v-show='chartMode === "dynamics"')
      ClientOnly
        template(#default)
          component.metric-series__apex(
            :is='ApexChart',
            type='line',
            height='240',
            :options='dynamicsOptions',
            :series='dynamicsSeries'
          )
        template(#fallback)
          .metric-series__skel-chart

    .metric-series__footer
      .metric-series__modes
        button.metric-series__mode(
          v-for='mode in chartModes',
          :key='mode.value',
          type='button',
          :class='{ "metric-series__mode--active": chartMode === mode.value }',
          @click='chartMode = mode.value'
        )
          | {{ mode.label }}
          q-tooltip {{ mode.hint }}
      .metric-series__scale.t-sm.t-muted Дни

  .metric-series__empty(v-else-if='!isLoading')
    EmptyState(title='Пока нет точек ряда — закройте задачу с привязкой метрики')
      template(#icon)
        q-icon(name='timeline', size='28px')

  .metric-series__skel(v-if='isLoading')
    .skel
</template>

<script setup lang="ts">
/**
 * Два графика: накопление (RATE) / уровень (LEVEL) и динамика.
 * Волновая разметка только в API (`getMetricWave`); здесь — факт + прогноз.
 * Правила проекции — `lib/projectMetricForecast.ts`.
 */
import { computed, defineAsyncComponent, ref, toRef } from 'vue';
import { useQuasar } from 'quasar';
import type { ApexOptions } from 'apexcharts';
import { EmptyState } from 'src/shared/ui/base';
import { ClientOnly } from 'src/shared/ui/ClientOnly';
import { useMetricSeries } from '../model';
import { formatPeriodLabel } from '../lib/formatPeriodLabel';
import { metricChartPalette } from '../lib/metricChartTheme';
import {
  buildSparseTooltip,
  formatMetric,
  isLevelSeriesMode,
  padForecastSeries,
  projectAccumulationPath,
  projectDynamicsPath,
  roundMetric,
  scenarioPathsFromWave,
} from '../lib/projectMetricForecast';

type ChartMode = 'accumulation' | 'dynamics';

const props = defineProps<{
  metricHash: string;
}>();

const $q = useQuasar();
const metricHashRef = toRef(props, 'metricHash');
const { series, wave, isLoading } = useMetricSeries(() => metricHashRef.value);

const chartMode = ref<ChartMode>('accumulation');

const ApexChart = defineAsyncComponent(() => import('vue3-apexcharts'));

const histCategories = computed(() => {
  const s = series.value;
  if (!s?.points.length) return [];
  return s.points.map((p) => formatPeriodLabel(p.period_start));
});

const forecastCategories = computed(() => [...histCategories.value, '→', '→→']);

const hasIdeal = computed(() =>
  !!series.value?.points.some((p) => p.ideal_cumulative != null),
);

const levelMode = computed(() =>
  isLevelSeriesMode(series.value?.series_mode, wave.value),
);

/** RATE — накопление дельт; LEVEL — текущий уровень (вес и т.п.). */
const chartModes = computed(() => [
  {
    label: levelMode.value ? 'Уровень' : 'Накопление',
    value: 'accumulation' as ChartMode,
    hint: levelMode.value
      ? 'Уровень и прогноз к цели'
      : 'Накопление и прогноз к цели',
  },
  {
    label: 'Динамика',
    value: 'dynamics' as ChartMode,
    hint: 'Изменения и прогноз динамики',
  },
]);

const scenarios = computed(() => scenarioPathsFromWave(wave.value));

const lastFact = computed(() => {
  const pts = series.value?.points;
  if (!pts?.length) return series.value?.fact ?? 0;
  return pts[pts.length - 1].cumulative;
});

const lastLevelForDynamics = computed(() => {
  if (!levelMode.value) return 0;
  const values = wave.value?.values;
  if (values?.length) return values[values.length - 1];
  return lastFact.value;
});

const baseChartOptions = computed((): ApexOptions => {
  void $q.dark.isActive;
  const p = metricChartPalette();

  return {
    chart: {
      background: 'transparent',
      foreColor: p.ink2,
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'inherit',
      animations: { enabled: true, speed: 300 },
    },
    theme: { mode: $q.dark.isActive ? 'dark' : 'light' },
    grid: {
      borderColor: p.line,
      strokeDashArray: 3,
      padding: { left: 8, right: 8 },
    },
    dataLabels: { enabled: false },
    legend: {
      position: 'bottom',
      horizontalAlign: 'left',
      fontSize: '12px',
      labels: { colors: p.ink3 },
      markers: { size: 4 },
    },
    yaxis: {
      labels: {
        style: { colors: p.ink3, fontSize: '11px' },
        formatter: (v: number) => formatMetric(v),
      },
    },
    tooltip: {
      theme: $q.dark.isActive ? 'dark' : 'light',
      shared: true,
      intersect: false,
      custom: buildSparseTooltip(),
    },
  };
});

function xaxisFor(categories: string[]): ApexOptions['xaxis'] {
  const p = metricChartPalette();
  return {
    categories,
    labels: {
      style: { colors: p.ink3, fontSize: '11px' },
      rotate: 0,
      hideOverlappingLabels: true,
    },
    axisBorder: { color: p.line },
    axisTicks: { color: p.line },
    tooltip: { enabled: false },
  };
}

const accumulationSeries = computed(() => {
  const s = series.value;
  if (!s?.points.length) return [];
  const factData = s.points.map((p) => roundMetric(p.cumulative));
  const result: { name: string; data: Array<number | null> }[] = [
    {
      name: 'Факт',
      data: [...factData, null, null],
    },
  ];
  if (hasIdeal.value) {
    result.push({
      name: 'План',
      data: [
        ...s.points.map((p) =>
          p.ideal_cumulative == null ? null : roundMetric(p.ideal_cumulative),
        ),
        null,
        null,
      ],
    });
  }

  const level = levelMode.value;
  for (const sc of scenarios.value) {
    const projected = projectAccumulationPath(sc.path, lastFact.value, {
      levelMode: level,
    });
    result.push({
      name: sc.label,
      data: padForecastSeries(factData, projected),
    });
  }

  return result;
});

const accumulationOptions = computed((): ApexOptions => {
  void $q.dark.isActive;
  const p = metricChartPalette();
  const target = series.value?.target_value ?? 0;
  const colors = [p.primary, p.ink3, p.pos, p.ink2, p.neg, p.warn, p.primary, p.ink2];
  const dash = accumulationSeries.value.map((_, i) => (i === 0 ? 0 : 6));
  const widths = accumulationSeries.value.map((_, i) => (i === 0 ? 2 : 1.5));

  return {
    ...baseChartOptions.value,
    colors: colors.slice(0, Math.max(accumulationSeries.value.length, 1)),
    stroke: {
      width: widths,
      curve: 'smooth',
      dashArray: dash,
    },
    markers: { size: 0, hover: { size: 5 } },
    xaxis: xaxisFor(forecastCategories.value),
    annotations: {
      yaxis: [
        {
          y: target,
          borderColor: p.warn,
          strokeDashArray: 4,
          label: {
            text: `Цель ${target}`,
            style: {
              color: p.warn,
              background: 'transparent',
              fontSize: '11px',
            },
            position: 'right',
            offsetX: 0,
          },
        },
      ],
    },
  };
});

const dynamicsSeries = computed(() => {
  const s = series.value;
  if (!s?.points.length) return [];
  const hist = s.points.map((p) => roundMetric(p.delta));
  const result: {
    name: string;
    type: 'bar' | 'line';
    data: Array<number | null>;
  }[] = [
    {
      name: 'Изменение',
      type: 'bar',
      data: [...hist, null, null],
    },
  ];

  const level = levelMode.value;
  for (const sc of scenarios.value) {
    const projected = projectDynamicsPath(sc.path, lastLevelForDynamics.value, {
      levelMode: level,
    });
    result.push({
      name: sc.label,
      type: 'line',
      data: padForecastSeries(hist, projected),
    });
  }

  return result;
});

const dynamicsOptions = computed((): ApexOptions => {
  void $q.dark.isActive;
  const p = metricChartPalette();
  const deltas = series.value?.points.map((pt) => pt.delta) ?? [];
  const absMax = Math.max(...deltas.map((d) => Math.abs(d)), 1);
  const n = dynamicsSeries.value.length;
  const colors = [p.primary, p.pos, p.ink2, p.neg, p.warn, p.primary, p.ink3];
  const dash = dynamicsSeries.value.map((_, i) => (i === 0 ? 0 : 5));
  const widths = dynamicsSeries.value.map((_, i) => (i === 0 ? 0 : 1.5));

  return {
    ...baseChartOptions.value,
    chart: {
      ...baseChartOptions.value.chart,
      type: 'line',
    },
    colors: colors.slice(0, Math.max(n, 1)),
    stroke: {
      width: widths,
      curve: 'straight',
      dashArray: dash,
    },
    plotOptions: {
      bar: {
        borderRadius: 2,
        columnWidth: '55%',
        colors: {
          ranges: [
            { from: -absMax * 10, to: -0.000001, color: p.neg },
            { from: 0, to: absMax * 10, color: p.primary },
          ],
        },
      },
    },
    markers: { size: 0, hover: { size: 5 } },
    xaxis: xaxisFor(forecastCategories.value),
    tooltip: {
      theme: $q.dark.isActive ? 'dark' : 'light',
      shared: true,
      intersect: false,
      custom: buildSparseTooltip({ signed: true }),
    },
  };
});
</script>

<style lang="scss" scoped>
.metric-series {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.metric-series__view {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.metric-series__footer {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2);
  min-height: 32px;
}

.metric-series__modes {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--p-1);
  min-width: 0;
  height: 32px;
}

.metric-series__mode {
  appearance: none;
  border: none;
  background: transparent;
  padding: 0 var(--p-2);
  height: 32px;
  font: inherit;
  font-size: var(--p-fs-caption);
  color: var(--p-ink-3);
  cursor: pointer;
  border-radius: var(--p-r-sm);
}

.metric-series__mode:hover {
  color: var(--p-ink-2);
}

.metric-series__mode--active {
  color: var(--p-ink);
  font-weight: 600;
  background: var(--p-surface-3, var(--p-line));
}

.metric-series__scale {
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.metric-series__chart {
  min-width: 0;
  padding: var(--p-2);
  background: var(--p-surface-2);
  border-radius: var(--p-r-sm);
}

.metric-series__apex {
  width: 100%;
  min-height: 240px;
}

.metric-series__skel-chart {
  height: 240px;
  border-radius: var(--p-r-sm);
  background: var(--p-surface-3, var(--p-surface-2));
}

.metric-series__empty {
  padding: var(--p-2) 0;
}

.metric-series__skel .skel {
  height: 240px;
  border-radius: var(--p-r-sm);
  background: var(--p-surface-2);
}
</style>
