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
    .plan-dialog__section.plan-dialog__finance
      .plan-dialog__section-title Финансовый план
      .plan-dialog__section-hint.t-sm Необязательно. Если часы не заданы — в блокчейн не отправляется, можно сохранить только цели по мерам.
      BaseInput(
        v-model='formData.plan_creators_hours',
        label='Плановое количество часов исполнителей',
        type='number',
        suffix='ч',
        :error='financeErrors.hours'
      )
      BaseInput(
        v-model='formData.plan_hour_cost',
        label='Стоимость часа работы',
        :suffix='governSymbol',
        :error='financeErrors.hourCost'
      )
      BaseInput(
        v-model='formData.plan_expenses',
        label='Дополнительные расходы',
        :suffix='governSymbol',
        :error='financeErrors.expenses'
      )

    .plan-dialog__section(v-if='showMetrics')
      .plan-dialog__section-head
        .plan-dialog__section-title Цели по мерам
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
        v-for='(row, index) in metricRows',
        :key='row.key'
      )
        .plan-dialog__metric-fields
          BaseSelect.plan-dialog__metric-measure(
            v-model='row.measure_hash',
            :options='measureSelectOptions',
            label='Мера',
            :placeholder='measuresLoading ? "Загрузка…" : "Выбрать из справочника"',
            @update:model-value='(val) => onMeasurePicked(index, val)'
          )
          BaseInput.plan-dialog__metric-target(
            v-model.number='row.target_value',
            label='Цель',
            type='number'
          )
        BaseButton(
          variant='ghost'
          size='sm',
          :icon-only='true',
          type='button',
          aria-label='Убрать цель',
          @click='removeMetricRow(index)'
        )
          template(#icon-left)
            q-icon(name='close' size='16px')

      .plan-dialog__metrics-hint.t-sm(v-if='!metricRows.length')
        | Целей пока нет — нажмите «Добавить» и выберите меру из справочника.
      .plan-dialog__metrics-hint.t-sm(v-else)
        | Меры задаются в справочнике на столе администратора. Здесь только выбор и цель.
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useSetPlan } from '../../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { CreateDialog } from 'src/shared/ui/CreateDialog';
import { BaseButton, BaseInput, BaseSelect } from 'src/shared/ui/base';
import type { BaseSelectOption } from 'src/shared/ui/base';
import type { IProject } from '../../../../../entities/Project/model';
import { isComponent } from 'app/extensions/capital/shared/lib/project-utils';
import { useSystemStore } from 'src/entities/System/model/store';
import { useComponentMetricStore } from 'app/extensions/capital/entities/ComponentMetric/model';
import { api } from 'app/extensions/capital/entities/ComponentMetric/api';
import type {
  IComponentMetric,
  IMeasure,
} from 'app/extensions/capital/entities/ComponentMetric/model';

interface MetricDraftRow {
  key: string;
  metric_hash?: string;
  measure_hash: string | null;
  title: string;
  unit: string;
  target_value: number;
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
const measuresLoading = ref(false);
const measures = ref<IMeasure[]>([]);

const formData = ref({
  plan_creators_hours: '' as string,
  plan_expenses: '',
  plan_hour_cost: '',
});

const financeErrors = ref({
  hours: '',
  hourCost: '',
  expenses: '',
});

const metricRows = ref<MetricDraftRow[]>([]);
/** Хеши целей, убранных из формы — архивируем при сохранении */
const removedMetricHashes = ref<string[]>([]);

const showMetrics = computed(
  () => !!props.project && isComponent(props.project),
);

const measureSelectOptions = computed<BaseSelectOption[]>(() =>
  measures.value.map((m) => ({
    value: m.measure_hash,
    label: m.unit.trim() ? `${m.title.trim()} · ${m.unit.trim()}` : m.title.trim(),
  })),
);

/** Финплан включается только если заданы часы > 0 — иначе on-chain setPlan не шлём. */
const hasFinancialPlan = computed(() => {
  const n = Number(formData.value.plan_creators_hours);
  return Number.isFinite(n) && n > 0;
});

const clearFinanceErrors = () => {
  financeErrors.value = { hours: '', hourCost: '', expenses: '' };
};

const validateFinanceFields = (): boolean => {
  clearFinanceErrors();
  if (!hasFinancialPlan.value) return true;

  let ok = true;
  if (!String(formData.value.plan_hour_cost ?? '').trim()) {
    financeErrors.value.hourCost = 'Укажите стоимость часа или очистите часы';
    ok = false;
  }
  if (!String(formData.value.plan_expenses ?? '').trim()) {
    financeErrors.value.expenses = 'Укажите расходы или очистите часы';
    ok = false;
  }
  const n = Number(formData.value.plan_creators_hours);
  if (!Number.isFinite(n) || n <= 0) {
    financeErrors.value.hours = 'Количество часов должно быть больше 0';
    ok = false;
  }
  return ok;
};

let draftKeySeq = 0;
const nextKey = () => `m-${++draftKeySeq}`;

const emptyMetricRow = (): MetricDraftRow => ({
  key: nextKey(),
  measure_hash: null,
  title: '',
  unit: '',
  target_value: 0,
});

const metricToRow = (m: IComponentMetric): MetricDraftRow => ({
  key: m.metric_hash,
  metric_hash: m.metric_hash,
  measure_hash: m.measure_hash,
  title: m.title,
  unit: m.unit,
  target_value: m.target_value,
});

const onMeasurePicked = (index: number, value: string | number | null) => {
  const row = metricRows.value[index];
  if (!row) return;
  const hash = value == null || value === '' ? null : String(value);
  row.measure_hash = hash;
  if (!hash) {
    row.title = '';
    row.unit = '';
    return;
  }
  const fromCatalog = measures.value.find((m) => m.measure_hash === hash);
  row.title = fromCatalog?.title ?? '';
  row.unit = fromCatalog?.unit ?? '';
};

const fillFinancialFromProject = () => {
  clearFinanceErrors();
  if (props.project?.is_planed && props.project.plan) {
    const hours = Number(props.project.plan.creators_hours) || 0;
    formData.value.plan_creators_hours = hours > 0 ? String(hours) : '';
    formData.value.plan_expenses = props.project.plan.target_expense_pool || '';
    formData.value.plan_hour_cost = props.project.plan.hour_cost || '';
  } else {
    formData.value = {
      plan_creators_hours: '',
      plan_expenses: '',
      plan_hour_cost: '',
    };
  }
};

const loadMeasuresCatalog = async () => {
  const { info } = useSystemStore();
  measuresLoading.value = true;
  try {
    measures.value = await api.getMeasures({
      coopname: info.coopname,
      status: Zeus.MetricStatus.ACTIVE,
    });
  } finally {
    measuresLoading.value = false;
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
    plan_creators_hours: '',
    plan_expenses: '',
    plan_hour_cost: '',
  };
  clearFinanceErrors();
  metricRows.value = [];
  removedMetricHashes.value = [];
};

const onDialogClosed = () => {
  clear();
};

const isMetricRowFilled = (row: MetricDraftRow) =>
  !!row.measure_hash && Number(row.target_value) > 0;

const syncMetrics = async (projectHash: string) => {
  const { info } = useSystemStore();

  for (const hash of removedMetricHashes.value) {
    const result = await api.archiveComponentMetric({ metric_hash: hash });
    metricStore.updateMetric(result);
  }

  for (const row of metricRows.value) {
    if (!isMetricRowFilled(row) || !row.measure_hash) continue;

    if (row.metric_hash) {
      const result = await api.updateComponentMetric({
        metric_hash: row.metric_hash,
        measure_hash: row.measure_hash,
        target_value: Number(row.target_value),
      });
      metricStore.updateMetric(result);
    } else {
      const result = await api.createComponentMetric({
        coopname: info.coopname,
        project_hash: projectHash,
        measure_hash: row.measure_hash,
        target_value: Number(row.target_value),
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
      (row.measure_hash || Number(row.target_value) > 0) && !isMetricRowFilled(row),
  );
  if (incomplete) {
    FailAlert('Выберите меру из справочника и укажите цель — или удалите пустые строки');
    return;
  }

  const finance = hasFinancialPlan.value;
  const metricsToSave =
    showMetrics.value &&
    (metricRows.value.some(isMetricRowFilled) || removedMetricHashes.value.length > 0);

  if (!finance && !metricsToSave) {
    FailAlert('Укажите финансовый план (часы > 0) или цели по мерам');
    return;
  }

  if (finance && !validateFinanceFields()) {
    return;
  }
  if (!finance) {
    clearFinanceErrors();
  }

  isSubmitting.value = true;
  try {
    if (finance) {
      const planData = {
        coopname: props.project.coopname || '',
        master: props.project.master || '',
        project_hash: props.project.project_hash,
        plan_creators_hours: Number(formData.value.plan_creators_hours),
        plan_expenses: formatAmountForEOSIO(formData.value.plan_expenses),
        plan_hour_cost: formatAmountForEOSIO(formData.value.plan_hour_cost),
      };
      await setPlan(planData);
    }

    if (showMetrics.value) {
      await syncMetrics(props.project.project_hash);
    }

    if (finance) {
      SuccessAlert(props.project.is_planed ? 'План сохранён' : 'План установлен');
    } else {
      SuccessAlert('Цели по мерам сохранены');
    }
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
    await Promise.all([loadMeasuresCatalog(), fillMetricsFromStore()]);
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

.plan-dialog__finance {
  gap: var(--p-1);

  /* BaseInput всегда reserve-hint-space — без ошибки схлопываем низ */
  :deep(.q-field__bottom) {
    min-height: 0;
    padding-top: 0;
  }

  :deep(.q-field--error .q-field__bottom) {
    min-height: auto;
    padding-top: var(--p-1);
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

.plan-dialog__section-hint {
  color: var(--p-ink-3);
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

.plan-dialog__metric-measure {
  flex: 1 1 auto;
  min-width: 0;
}

.plan-dialog__metric-target {
  flex: 0 0 120px;
  width: 120px;
}

.plan-dialog__metrics-hint {
  color: var(--p-ink-3);
}
</style>
