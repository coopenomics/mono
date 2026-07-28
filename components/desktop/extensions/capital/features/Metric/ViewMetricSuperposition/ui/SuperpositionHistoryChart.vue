<template lang="pug">
.sp-history-chart
  ClientOnly
    template(#default)
      component.sp-history-chart__apex(
        :is='ApexChart',
        type='area',
        height='320',
        :options='chartOptions',
        :series='chartSeries'
      )
    template(#fallback)
      .sp-history-chart__skel
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useQuasar } from 'quasar';
import type { ApexOptions } from 'apexcharts';
import { Zeus } from '@coopenomics/sdk';
import { ClientOnly } from 'src/shared/ui/ClientOnly';
import { formatPeriodLabel } from 'app/extensions/capital/features/Metric/ViewMetricSeries/lib/formatPeriodLabel';
import { metricChartPalette } from 'app/extensions/capital/features/Metric/ViewMetricSeries/lib/metricChartTheme';
import { superpositionScore } from '../lib/superpositionPolar';
import type { IMetricSuperpositionFrame } from 'app/extensions/capital/entities/ComponentMetric/model';

const props = defineProps<{
  frames: IMetricSuperpositionFrame[];
  frameIndex: number;
  period: Zeus.ModelTypes['MetricSeriesPeriod'];
}>();

const emit = defineEmits<{
  select: [index: number];
}>();

const $q = useQuasar();
const ApexChart = defineAsyncComponent(() => import('vue3-apexcharts'));

const toPct = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 100);

const categories = computed(() =>
  props.frames.map((f) => formatPeriodLabel(f.at, props.period)),
);

const scoreSeries = computed(() =>
  props.frames.map((f) => toPct(superpositionScore(f.balance, f.growth, f.activity))),
);

/** Заливка до выбранного кадра; дальше линия без заливки */
const passedScore = computed(() => {
  const idx = Math.max(0, Math.min(props.frameIndex, props.frames.length - 1));
  return scoreSeries.value.map((v, i) => (i <= idx ? v : null));
});

const chartSeries = computed(() => [
  {
    name: 'Пройдено',
    type: 'area',
    data: passedScore.value,
  },
  {
    name: 'Суперпозиция',
    type: 'line',
    data: scoreSeries.value,
  },
]);

const selectedCategory = computed(() => {
  const cats = categories.value;
  if (!cats.length) return undefined;
  const idx = Math.max(0, Math.min(props.frameIndex, cats.length - 1));
  return cats[idx];
});

const chartOptions = computed((): ApexOptions => {
  void $q.dark.isActive;
  void props.frameIndex;
  const p = metricChartPalette();
  const cats = categories.value;
  const xAnno = selectedCategory.value;

  return {
    chart: {
      background: 'transparent',
      foreColor: p.ink2,
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'inherit',
      animations: { enabled: false },
      events: {
        markerClick: (_e, _ctx, cfg) => {
          const i = cfg?.dataPointIndex;
          if (typeof i === 'number' && i >= 0) emit('select', i);
        },
        click: (_e, _ctx, cfg) => {
          const i = cfg?.dataPointIndex;
          if (typeof i === 'number' && i >= 0) emit('select', i);
        },
      },
    },
    theme: { mode: $q.dark.isActive ? 'dark' : 'light' },
    colors: [p.primary, p.primary],
    stroke: {
      curve: 'smooth',
      width: [0, 2.5],
    },
    fill: {
      type: ['gradient', 'solid'],
      opacity: [0.4, 1],
      gradient: {
        shadeIntensity: 0.45,
        opacityFrom: 0.5,
        opacityTo: 0.06,
        stops: [0, 90, 100],
      },
    },
    grid: {
      borderColor: p.line,
      strokeDashArray: 3,
      padding: { left: 4, right: 8, top: 8, bottom: 0 },
    },
    dataLabels: { enabled: false },
    markers: {
      size: [0, 3],
      hover: { size: 6 },
      strokeWidth: 0,
    },
    legend: { show: false },
    xaxis: {
      categories: cats,
      labels: {
        style: { colors: p.ink3, fontSize: '11px' },
        rotate: 0,
        hideOverlappingLabels: true,
      },
      axisBorder: { color: p.line },
      axisTicks: { color: p.line },
      tooltip: { enabled: false },
    },
    yaxis: {
      min: 0,
      max: 100,
      tickAmount: 4,
      labels: {
        style: { colors: p.ink3, fontSize: '11px' },
        formatter: (v: number) => `${Math.round(v)}%`,
      },
    },
    tooltip: {
      theme: $q.dark.isActive ? 'dark' : 'light',
      shared: false,
      intersect: true,
      y: {
        formatter: (v: number | null) =>
          v == null || Number.isNaN(v) ? '—' : `${Math.round(v)}%`,
      },
    },
    annotations: xAnno
      ? {
          xaxis: [
            {
              x: xAnno,
              borderColor: p.primary,
              strokeDashArray: 0,
              borderWidth: 2,
              label: {
                borderColor: p.primary,
                style: {
                  color: p.primary,
                  background: p.surface2,
                  fontSize: '11px',
                },
                text: 'срез',
                orientation: 'horizontal',
                offsetY: 0,
              },
            },
          ],
        }
      : undefined,
  };
});
</script>

<style lang="scss" scoped>
.sp-history-chart {
  width: 100%;
  height: 100%;
  min-height: 320px;
}

.sp-history-chart__apex {
  width: 100%;
}

.sp-history-chart__skel {
  height: 320px;
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
}
</style>
