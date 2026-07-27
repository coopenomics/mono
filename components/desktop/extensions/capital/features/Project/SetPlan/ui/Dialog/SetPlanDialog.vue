<template lang="pug">
CreateDialog(
  ref="dialogRef"
  title="План"
  submit-text="Сохранить план"
  size="xl"
  :is-submitting="isSubmitting"
  @submit="handleSubmit"
  @dialog-closed="onDialogClosed"
)
  template(#form-fields)
    .plan-dialog__section
      .plan-dialog__section-title Финансовый план
      q-input(
        v-model.number='formData.plan_creators_hours'
        label='Плановое количество часов исполнителей'
        type='number'
        :rules='[(val) => val > 0 || "Количество часов должно быть больше 0"]'
        outlined
        dense
        class='q-mb-sm'
      )
        template(#append)
          span.text-grey-7 ч

      q-input(
        v-model='formData.plan_hour_cost'
        label='Стоимость часа работы'
        :rules='[(val) => !!val || "Стоимость часа работы обязательна"]'
        outlined
        dense
        class='q-mb-sm'
      )
        template(#append)
          span.text-grey-7 {{ governSymbol }}

      q-input(
        v-model='formData.plan_expenses'
        label='Дополнительные расходы'
        :rules='[(val) => !!val || "Плановые расходы обязательны"]'
        outlined
        dense
      )
        template(#append)
          span.text-grey-7 {{ governSymbol }}

    .plan-dialog__section(v-if='showMetrics')
      .plan-dialog__section-head
        .plan-dialog__section-title Метрики
        BaseButton(
          variant='ghost'
          size='sm'
          type='button'
          @click='addMetricRow'
        )
          template(#icon-left)
            q-icon(name='add' size='16px')
          | Добавить

      .plan-dialog__metric(
        v-for='(row, index) in metricRows'
        :key='row.key'
      )
        .plan-dialog__metric-fields
          q-input.plan-dialog__metric-title(
            v-model='row.title'
            label='Название'
            outlined
            dense
          )
          q-input.plan-dialog__metric-unit(
            v-model='row.unit'
            label='Ед.'
            outlined
            dense
          )
          q-input.plan-dialog__metric-target(
            v-model.number='row.target_value'
            label='Цель'
            type='number'
            outlined
            dense
          )
          q-select.plan-dialog__metric-mode(
            v-model='row.series_mode'
            :options='seriesModeOptions'
            label='Режим'
            emit-value
            map-options
            outlined
            dense
            options-dense
          )
        BaseButton(
          variant='ghost'
          size='sm'
          :icon-only='true'
          type='button'
          aria-label='Убрать метрику'
          @click='removeMetricRow(index)'
        )
          template(#icon-left)
            q-icon(name='close' size='16px')

      .plan-dialog__metrics-hint.t-sm(v-if='!metricRows.length')
        | Метрик пока нет — нажмите «Добавить»
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useSetPlan } from '../../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { CreateDialog } from 'src/shared/ui/CreateDialog';
import { BaseButton } from 'src/shared/ui/base';
import type { IProject } from '../../../../../entities/Project/model';
import { isComponent } from 'app/extensions/capital/shared/lib/project-utils';
import { useSystemStore } from 'src/entities/System/model/store';
import { useComponentMetricStore } from 'app/extensions/capital/entities/ComponentMetric/model';
import { api } from 'app/extensions/capital/entities/ComponentMetric/api';
import type { IComponentMetric } from 'app/extensions/capital/entities/ComponentMetric/model';

interface MetricDraftRow {
  key: string;
  metric_hash?: string;
  title: string;
  unit: string;
  target_value: number;
  series_mode: Zeus.MetricSeriesMode;
}

const props = defineProps<{ project: IProject | null | undefined }>();

const emit = defineEmits<{
  success: [];
  error: [error: unknown];
}>();

const dialogRef = ref();
const { setPlan, governSymbol, formatAmountForEOSIO } = useSetPlan();
const metricStore = useComponentMetricStore();
const isSubmitting = ref(false);

const formData = ref({
  plan_creators_hours: 0,
  plan_expenses: '',
  plan_hour_cost: '',
});

const metricRows = ref<MetricDraftRow[]>([]);
/** Хеши метрик, убранных из формы — архивируем при сохранении */
const removedMetricHashes = ref<string[]>([]);

const showMetrics = computed(
  () => !!props.project && isComponent(props.project),
);

const seriesModeOptions = [
  { label: 'Δ', value: Zeus.MetricSeriesMode.RATE },
  { label: 'Уровень', value: Zeus.MetricSeriesMode.LEVEL },
];

let draftKeySeq = 0;
const nextKey = () => `m-${++draftKeySeq}`;

const emptyMetricRow = (): MetricDraftRow => ({
  key: nextKey(),
  title: '',
  unit: '',
  target_value: 0,
  series_mode: Zeus.MetricSeriesMode.RATE,
});

const metricToRow = (m: IComponentMetric): MetricDraftRow => ({
  key: m.metric_hash,
  metric_hash: m.metric_hash,
  title: m.title,
  unit: m.unit,
  target_value: m.target_value,
  series_mode: m.series_mode,
});

const fillFinancialFromProject = () => {
  if (props.project?.is_planed && props.project.plan) {
    formData.value.plan_creators_hours = props.project.plan.creators_hours || 0;
    formData.value.plan_expenses = props.project.plan.target_expense_pool || '';
    formData.value.plan_hour_cost = props.project.plan.hour_cost || '';
  } else {
    formData.value = {
      plan_creators_hours: 0,
      plan_expenses: '',
      plan_hour_cost: '',
    };
  }
};

const fillMetricsFromStore = async () => {
  if (!props.project || !showMetrics.value) {
    metricRows.value = [];
    removedMetricHashes.value = [];
    return;
  }
  const hash = props.project.project_hash;
  await metricStore.loadMetrics({ project_hash: hash });
  const active = metricStore
    .getMetricsByProject(hash)
    .filter((m) => m.status !== Zeus.MetricStatus.ARCHIVED);
  metricRows.value = active.map(metricToRow);
  removedMetricHashes.value = [];
};

const addMetricRow = () => {
  metricRows.value.push(emptyMetricRow());
};

const removeMetricRow = (index: number) => {
  const row = metricRows.value[index];
  if (!row) return;
  if (row.metric_hash) {
    removedMetricHashes.value.push(row.metric_hash);
  }
  metricRows.value.splice(index, 1);
};

const clear = () => {
  formData.value = {
    plan_creators_hours: 0,
    plan_expenses: '',
    plan_hour_cost: '',
  };
  metricRows.value = [];
  removedMetricHashes.value = [];
};

const onDialogClosed = () => {
  clear();
};

const isMetricRowFilled = (row: MetricDraftRow) =>
  !!row.title.trim() && !!row.unit.trim() && Number(row.target_value) > 0;

const syncMetrics = async (projectHash: string) => {
  const { info } = useSystemStore();

  for (const hash of removedMetricHashes.value) {
    const result = await api.archiveComponentMetric({ metric_hash: hash });
    metricStore.updateMetric(result);
  }

  for (const row of metricRows.value) {
    if (!isMetricRowFilled(row)) continue;

    if (row.metric_hash) {
      const result = await api.updateComponentMetric({
        metric_hash: row.metric_hash,
        title: row.title.trim(),
        unit: row.unit.trim(),
        target_value: Number(row.target_value),
        series_mode: row.series_mode,
      });
      metricStore.updateMetric(result);
    } else {
      const result = await api.createComponentMetric({
        coopname: info.coopname,
        project_hash: projectHash,
        title: row.title.trim(),
        unit: row.unit.trim(),
        target_value: Number(row.target_value),
        series_mode: row.series_mode,
      });
      metricStore.addMetric(result);
    }
  }
};

const handleSubmit = async () => {
  if (!props.project) return;

  if (!props.project.permissions?.can_set_plan) {
    FailAlert('У вас нет прав на установку плана');
    return;
  }

  const incomplete = metricRows.value.some(
    (row) =>
      (row.title.trim() || row.unit.trim() || Number(row.target_value) > 0) &&
      !isMetricRowFilled(row),
  );
  if (incomplete) {
    FailAlert('Заполните название, единицу и цель у каждой метрики или удалите пустые строки');
    return;
  }

  isSubmitting.value = true;
  try {
    const planData = {
      coopname: props.project.coopname || '',
      master: props.project.master || '',
      project_hash: props.project.project_hash,
      plan_creators_hours: formData.value.plan_creators_hours,
      plan_expenses: formatAmountForEOSIO(formData.value.plan_expenses),
      plan_hour_cost: formatAmountForEOSIO(formData.value.plan_hour_cost),
    };

    await setPlan(planData);

    if (showMetrics.value) {
      await syncMetrics(props.project.project_hash);
    }

    SuccessAlert(props.project.is_planed ? 'План сохранён' : 'План установлен');
    dialogRef.value?.clear();
    emit('success');
  } catch (error) {
    FailAlert(error);
    emit('error', error);
  } finally {
    isSubmitting.value = false;
  }
};

const openDialog = async () => {
  fillFinancialFromProject();
  try {
    await fillMetricsFromStore();
  } catch (error) {
    FailAlert(error);
  }
  dialogRef.value?.openDialog();
};

defineExpose({
  openDialog,
  clear: () => dialogRef.value?.clear(),
});
</script>

<style lang="scss" scoped>
.plan-dialog__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  margin-bottom: var(--p-4);

  &:last-child {
    margin-bottom: 0;
  }
}

.plan-dialog__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2);
}

.plan-dialog__section-title {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink);
}

.plan-dialog__metric {
  display: flex;
  align-items: flex-start;
  gap: var(--p-1);
  padding: var(--p-2);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
}

.plan-dialog__metric-fields {
  flex: 1;
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: var(--p-2);
  min-width: 0;
}

.plan-dialog__metric-title {
  flex: 1 1 auto;
  min-width: 0;
}

.plan-dialog__metric-unit {
  flex: 0 0 64px;
  width: 64px;
}

.plan-dialog__metric-target {
  flex: 0 0 88px;
  width: 88px;
}

.plan-dialog__metric-mode {
  flex: 0 0 86px;
  width: 86px;
}

.plan-dialog__metrics-hint {
  color: var(--p-ink-3);
}
</style>
