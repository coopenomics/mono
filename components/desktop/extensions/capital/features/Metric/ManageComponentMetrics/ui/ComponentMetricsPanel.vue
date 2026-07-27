<template lang="pug">
.metrics-panel
  .metrics-panel__head
    .metrics-panel__title Метрики компонента

  .metrics-panel__list(v-if='!isLoading && metricList.length')
    .metric-item(v-for='metric in metricList', :key='metric.metric_hash')
      .metric-item__header
        .metric-item__title {{ metric.title }}
        q-badge(
          v-if='metric.status === archivedStatus',
          color='grey-5',
          text-color='white',
          label='архив'
        )

      .metric-item__progress
        .metric-item__values
          span.metric-item__fact {{ metric.fact }}
          span.metric-item__sep &nbsp;/&nbsp;
          span.metric-item__target {{ metric.target_value }} {{ metric.unit }}
        q-linear-progress(
          :value='progressValue(metric)',
          color='primary',
          track-color='grey-3',
          rounded
          size='6px'
        )

      MetricSeriesPanel(:metric-hash='metric.metric_hash')

  .metrics-panel__empty(v-else-if='!isLoading && !metricList.length')
    EmptyState(title='Метрики не заданы — откройте «План»')
      template(#icon)
        q-icon(name='bar_chart', size='32px')

  .metrics-panel__skel(v-if='isLoading')
    .skel(v-for='i in 3', :key='i')
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { EmptyState } from 'src/shared/ui/base';
import { MetricSeriesPanel } from '../../ViewMetricSeries';
import { useManageComponentMetrics } from '../model';

const props = defineProps<{
  projectHash: string;
}>();

const {
  isLoading,
  metrics,
  loadMetrics,
} = useManageComponentMetrics(props.projectHash);

const archivedStatus = Zeus.MetricStatus.ARCHIVED;

const metricList = computed(() =>
  metrics().filter((m) => m.status !== archivedStatus),
);

const progressValue = (metric: { fact: number; target_value: number }) => {
  if (!metric.target_value) return 0;
  return Math.min(metric.fact / metric.target_value, 1);
};

onMounted(async () => {
  await loadMetrics();
});
</script>

<style lang="scss" scoped>
.metrics-panel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.metrics-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.metrics-panel__title {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink);
}

.metrics-panel__list {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.metrics-panel__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.metric-item {
  padding: var(--p-3) var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.metric-item__header {
  display: flex;
  align-items: center;
  gap: var(--p-2);
}

.metric-item__title {
  flex: 1;
  font-size: var(--p-fs-body-sm);
  font-weight: 500;
  color: var(--p-ink);
}

.metric-item__progress {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.metric-item__values {
  display: flex;
  flex-wrap: wrap;
  font-size: var(--p-fs-caption);
  color: var(--p-ink-2);
}

.metric-item__fact {
  font-family: var(--p-mono);
  font-weight: 600;
  color: var(--p-ink);
}

.metric-item__sep {
  color: var(--p-line-2);
}

.metric-item__target {
  font-family: var(--p-mono);
  color: var(--p-ink-3);
}

.metrics-panel__empty {
  padding: var(--p-4) 0;
}
</style>
