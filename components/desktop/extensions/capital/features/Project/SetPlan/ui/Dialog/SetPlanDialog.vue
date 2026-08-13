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
    .plan-dialog__section.plan-dialog__finance(v-if='!isLocalProject')
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
        .plan-dialog__section-actions
          BaseButton(
            v-if='measures.length'
            variant='ghost'
            size='sm'
            type='button'
          )
            template(#icon-left)
              q-icon(name='history' size='16px')
            | Из своих
            q-menu(auto-close)
              q-list(dense style='min-width: 220px')
                q-item(
                  v-for='measure in measures',
                  :key='measure.measure_hash',
                  clickable,
                  @click='addMetricRowFromMeasure(measure)'
                )
                  q-item-section {{ measure.title }}
                  q-item-section(side) {{ measure.unit }}
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
          BaseInput.plan-dialog__metric-measure(
            v-model='row.title',
            label='Мера',
            placeholder='Например: ролики'
          )
          BaseInput.plan-dialog__metric-unit(
            v-model='row.unit',
            label='Ед. изм.',
            placeholder='шт'
          )
          BaseSelect.plan-dialog__metric-mode(
            v-model='row.series_mode',
            :options='seriesModeOptions',
            label='Тип'
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
        | Целей пока нет — нажмите «Добавить» и впишите меру своими словами.
      .plan-dialog__metrics-hint.t-sm(v-else)
        | Мера пишется как удобно. Новая попадёт в меры кооператива — потом её можно взять кнопкой «Из своих».
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
  /** Мера, к которой цель привязана сейчас; при правке текста уходит в null */
  measure_hash: string | null;
  title: string;
  unit: string;
  /** Скорость (Δ за день) или уровень значения — как строится ряд меры */
  series_mode: Zeus.ModelTypes['MetricSeriesMode'];
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

const isLocalProject = computed(() => props.project?.origin === 'local');

const canEditMetrics = computed(() => {
  const perms = props.project?.permissions;
  if (!perms) return false;
  return !!(perms.can_manage_issues || perms.can_edit_project);
});

/** Финплан включается только если заданы часы > 0 — иначе on-chain setPlan не шлём. LOCAL — без финансов. */
const hasFinancialPlan = computed(() => {
  if (isLocalProject.value) return false;
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

const seriesModeOptions: BaseSelectOption[] = [
  { value: Zeus.MetricSeriesMode.RATE, label: 'Скорость' },
  { value: Zeus.MetricSeriesMode.LEVEL, label: 'Уровень' },
];

let draftKeySeq = 0;
const nextKey = () => `m-${++draftKeySeq}`;

const emptyMetricRow = (): MetricDraftRow => ({
  key: nextKey(),
  measure_hash: null,
  title: '',
  unit: '',
  series_mode: Zeus.MetricSeriesMode.RATE,
  target_value: 0,
});

const metricToRow = (m: IComponentMetric): MetricDraftRow => ({
  key: m.metric_hash,
  metric_hash: m.metric_hash,
  measure_hash: m.measure_hash,
  title: m.title,
  unit: m.unit,
  series_mode: m.series_mode,
  target_value: m.target_value,
});

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

/** Меры, которые кооператив уже завёл: подсказка, а не обязательный справочник. */
const loadOwnMeasures = async () => {
  const { info } = useSystemStore();
  measures.value = await api.getMeasures({
    coopname: info.coopname,
    status: Zeus.MetricStatus.ACTIVE,
  });
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

/** Подставляет уже заведённую меру кооператива — печатать заново не нужно. */
const addMetricRowFromMeasure = (measure: IMeasure) => {
  metricRows.value.push({
    ...emptyMetricRow(),
    measure_hash: measure.measure_hash,
    title: measure.title,
    unit: measure.unit,
    series_mode: measure.series_mode,
  });
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
  !!row.title.trim() && !!row.unit.trim() && Number(row.target_value) > 0;

/** Строка тронута: что-то введено — значит её нужно либо дозаполнить, либо убрать. */
const isMetricRowTouched = (row: MetricDraftRow) =>
  !!row.title.trim() || !!row.unit.trim() || Number(row.target_value) > 0;

const syncMetrics = async (projectHash: string) => {
  const { info } = useSystemStore();

  for (const hash of removedMetricHashes.value) {
    const result = await api.archiveComponentMetric({ metric_hash: hash });
    metricStore.updateMetric(result);
  }

  for (const row of metricRows.value) {
    if (!isMetricRowFilled(row)) continue;

    const title = row.title.trim();
    const unit = row.unit.trim();

    if (row.metric_hash) {
      const result = await api.updateComponentMetric({
        metric_hash: row.metric_hash,
        title,
        unit,
        series_mode: row.series_mode,
        target_value: Number(row.target_value),
      });
      metricStore.updateMetric(result);
    } else {
      const result = await api.createComponentMetric({
        coopname: info.coopname,
        project_hash: projectHash,
        title,
        unit,
        series_mode: row.series_mode,
        target_value: Number(row.target_value),
      });
      metricStore.addMetric(result);
    }
  }
};

const handleSubmit = async () => {
  if (!props.project) return;

  const canFinance = !!props.project.permissions?.can_set_plan;
  if (!isLocalProject.value && !canFinance) {
    FailAlert('У вас нет прав на установку плана');
    return;
  }
  if (isLocalProject.value && !canEditMetrics.value) {
    FailAlert('У вас нет прав на редактирование целей по мерам');
    return;
  }

  const incomplete = metricRows.value.some(
    (row) => isMetricRowTouched(row) && !isMetricRowFilled(row),
  );
  if (incomplete) {
    FailAlert('Впишите меру, единицу измерения и цель — или удалите незаполненные строки');
    return;
  }

  const finance = hasFinancialPlan.value;
  const metricsToSave =
    showMetrics.value &&
    (metricRows.value.some(isMetricRowFilled) || removedMetricHashes.value.length > 0);

  if (!finance && !metricsToSave) {
    FailAlert(
      isLocalProject.value
        ? 'Укажите цели по мерам'
        : 'Укажите финансовый план (часы > 0) или цели по мерам',
    );
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
    await Promise.all([loadOwnMeasures(), fillMetricsFromStore()]);
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

.plan-dialog__section-actions {
  display: flex;
  align-items: center;
  gap: var(--p-1);
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

.plan-dialog__metric-unit {
  flex: 0 0 110px;
  width: 110px;
}

.plan-dialog__metric-mode {
  flex: 0 0 130px;
  width: 130px;
}

.plan-dialog__metric-target {
  flex: 0 0 110px;
  width: 110px;
}

.plan-dialog__metrics-hint {
  color: var(--p-ink-3);
}
</style>
