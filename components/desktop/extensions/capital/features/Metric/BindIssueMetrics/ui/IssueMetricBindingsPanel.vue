<template lang="pug">
.bind-metrics(v-if='isLoading || activeMetrics.length')
  .bind-metrics__skel(v-if='isLoading')
    .skel(v-for='i in 2', :key='i')
  template(v-else)
    q-input.bind-metrics__input(
      v-for='metric in activeMetrics',
      :key='metric.metric_hash',
      :model-value='deltaByMetric[metric.metric_hash] ?? ""',
      type='number',
      step='any',
      standout='bg-teal text-white',
      :label='metric.title',
      :readonly='readonly',
      :suffix='metric.unit',
      dense,
      @update:model-value='(v) => onDeltaChange(metric.metric_hash, v)'
    )
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useBindIssueMetrics } from '../model';

const props = withDefaults(
  defineProps<{
    issueHash: string;
    projectHash: string;
    readonly?: boolean;
  }>(),
  { readonly: false },
);

const {
  activeMetrics,
  deltaByMetric,
  isLoading,
  loadAll,
  onDeltaChange,
} = useBindIssueMetrics(props.issueHash, props.projectHash);

onMounted(async () => {
  await loadAll();
});
</script>

<style lang="scss" scoped>
.bind-metrics {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  width: 100%;
}

.bind-metrics__input {
  width: 100%;
}

.bind-metrics__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.bind-metrics__skel .skel {
  height: 40px;
  border-radius: var(--p-r-sm);
  background: var(--p-surface-2);
}
</style>
