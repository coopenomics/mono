<template lang="pug">
.bind-metrics-panel
  .bind-metrics-panel__head
    .bind-metrics-panel__title Вклад в метрики
  .bind-metrics-panel__skel(v-if='isLoading')
    .skel(v-for='i in 3', :key='i')

  template(v-else-if='activeMetrics.length')
    .bind-metrics-panel__rows
      .bind-metric-row(v-for='metric in activeMetrics', :key='metric.metric_hash')
        .bind-metric-row__info
          .bind-metric-row__name {{ metric.title }}
          .bind-metric-row__unit.t-mono {{ metric.unit }}
        BaseInput(
          v-model='deltaByMetric[metric.metric_hash]',
          type='number',
          :label='`Δ (${metric.unit})`',
          :suffix='metric.unit'
        )
    .bind-metrics-panel__actions
      BaseButton(
        variant='primary',
        size='sm',
        :loading='isSaving',
        @click='saveBindings'
      )
        template(#icon-left)
          q-icon(name='save', size='16px')
        | Сохранить привязки

  .bind-metrics-panel__empty(v-else)
    EmptyState(title='Нет активных метрик для этого компонента')
      template(#icon)
        q-icon(name='bar_chart', size='28px')
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { BaseButton, BaseInput, EmptyState } from 'src/shared/ui/base';
import { useBindIssueMetrics } from '../model';

const props = defineProps<{
  issueHash: string;
  projectHash: string;
}>();

const {
  activeMetrics,
  deltaByMetric,
  isLoading,
  isSaving,
  loadAll,
  saveBindings,
} = useBindIssueMetrics(props.issueHash, props.projectHash);

onMounted(async () => {
  await loadAll();
});
</script>

<style lang="scss" scoped>
.bind-metrics-panel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.bind-metrics-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bind-metrics-panel__title {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink);
}

.bind-metrics-panel__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.bind-metrics-panel__rows {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.bind-metric-row {
  display: flex;
  align-items: center;
  gap: var(--p-3);
}

.bind-metric-row__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}

.bind-metric-row__name {
  font-size: var(--p-fs-body-sm);
  font-weight: 500;
  color: var(--p-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bind-metric-row__unit {
  font-size: var(--p-fs-caption);
  color: var(--p-ink-3);
}

.bind-metrics-panel__actions {
  display: flex;
  justify-content: flex-end;
}

.bind-metrics-panel__empty {
  padding: var(--p-4) 0;
}
</style>
