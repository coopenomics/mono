<template lang="pug">
.metrics-panel
  .metrics-panel__head
    .metrics-panel__title Метрики компонента
    BaseButton(
      v-if='!showForm',
      variant='ghost',
      size='sm',
      @click='showForm = true'
    )
      template(#icon-left)
        q-icon(name='add', size='16px')
      | Добавить

  .metrics-panel__form(v-if='showForm')
    .row.q-col-gutter-sm
      .col-12
        BaseInput(
          v-model='form.title',
          label='Название метрики',
          placeholder='Например: Выручка, Пользователи'
        )
      .col-6
        BaseInput(
          v-model='form.unit',
          label='Единица измерения',
          placeholder='руб, шт, %'
        )
      .col-6
        BaseInput(
          v-model='form.target_value',
          label='Целевое значение',
          type='number'
        )
      .col-12
        BaseSelect(
          v-model='form.series_mode',
          :options='seriesModeOptions',
          label='Режим накопления'
        )
    .metrics-panel__form-actions
      BaseButton(variant='ghost', size='sm', @click='cancelForm') Отмена
      BaseButton(
        variant='primary',
        size='sm',
        :loading='isSubmitting',
        :disabled='!canCreate',
        @click='handleCreate'
      ) Создать

  .metrics-panel__list(v-if='!isLoading && metricList.length')
    .metric-item(v-for='metric in metricList', :key='metric.metric_hash')
      .metric-item__header
        .metric-item__title {{ metric.title }}
        .metric-item__unit.t-mono {{ metric.unit }}
        q-badge(
          v-if='metric.status === archivedStatus',
          color='grey-5',
          text-color='white',
          label='архив'
        )
        BaseButton(
          v-if='metric.status !== archivedStatus',
          variant='ghost',
          size='sm',
          :icon-only='true',
          aria-label='Архивировать',
          @click='handleArchive(metric.metric_hash)'
        )
          template(#icon-left)
            q-icon(name='archive', size='16px')
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

  .metrics-panel__empty(v-else-if='!isLoading && !metricList.length && !showForm')
    EmptyState(title='Метрики не добавлены')
      template(#icon)
        q-icon(name='bar_chart', size='32px')

  .metrics-panel__skel(v-if='isLoading')
    .skel(v-for='i in 3', :key='i')
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { BaseButton, BaseInput, BaseSelect, EmptyState } from 'src/shared/ui/base';
import { useManageComponentMetrics } from '../model';

const props = defineProps<{
  projectHash: string;
}>();

const {
  form,
  isSubmitting,
  isLoading,
  metrics,
  loadMetrics,
  createMetric,
  archiveMetric,
  resetForm,
} = useManageComponentMetrics(props.projectHash);

const showForm = ref(false);
const archivedStatus = Zeus.MetricStatus.ARCHIVED;

const metricList = computed(() => metrics());

const seriesModeOptions = [
  { label: 'Скорость (Δ за период)', value: Zeus.MetricSeriesMode.RATE },
  { label: 'Уровень значения', value: Zeus.MetricSeriesMode.LEVEL },
];

const canCreate = computed(() =>
  !!form.value.title.trim() && !!form.value.unit.trim() && form.value.target_value > 0,
);

const progressValue = (metric: { fact: number; target_value: number }) => {
  if (!metric.target_value) return 0;
  return Math.min(metric.fact / metric.target_value, 1);
};

const cancelForm = () => {
  showForm.value = false;
  resetForm();
};

const handleCreate = async () => {
  await createMetric();
  showForm.value = false;
};

const handleArchive = async (metricHash: string) => {
  await archiveMetric(metricHash);
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

.metrics-panel__form {
  padding: var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.metrics-panel__form-actions {
  display: flex;
  gap: var(--p-2);
  justify-content: flex-end;
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
  gap: var(--p-2);
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

.metric-item__unit {
  font-size: var(--p-fs-caption);
  color: var(--p-ink-2);
  font-family: var(--p-mono);
}

.metric-item__progress {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.metric-item__values {
  display: flex;
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
