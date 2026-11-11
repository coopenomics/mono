<template lang="pug">
//- Новый плановый расход участка (задача 99D-34, решение владельца 11.11.2026).
//- Три раздела сверху вниз: что оплачиваем (назначение, сумма, срок) →
//- повторяемость со сроками платежей и резервом в месяц → реквизиты. Сроки и
//- резерв считает сервер тем же календарём, по которому реестр продолжает
//- серию, а итог месяца собирает резерв: диалог обещает ровно то, что будет.
BaseDialog(
  :model-value='modelValue',
  :title='$t("marketplace.expensePlanDialog.title")',
  size='md',
  @update:model-value='emit("update:modelValue", $event)'
)
  .plan-form
    section.plan-form__section
      h3.plan-form__label.t-eyebrow {{ $t('marketplace.expensePlanDialog.whatSection') }}
      BaseInput(
        v-model='title',
        :label='$t("marketplace.expensePlanDialog.purposeLabel")',
        :placeholder='$t("marketplace.expensePlanDialog.purposePlaceholder")',
        stack-label,
        required
      )
      .plan-form__pair
        AmountInput(
          v-model='amount',
          :label='$t("marketplace.expensePlanDialog.amountLabel")',
          :precision='2',
          :min='0'
        )
        BaseInput(
          v-model='dueDate',
          type='date',
          :label='$t("marketplace.expensePlanDialog.dueDateLabel")',
          stack-label,
          required
        )

    section.plan-form__section
      h3.plan-form__label.t-eyebrow {{ $t('marketplace.expensePlanDialog.recurrenceSection') }}
      .plan-form__choices
        BaseRadioCard(
          v-for='option in recurrenceOptions',
          :key='option.value',
          v-model='recurrence',
          :value='option.value',
          :title='option.title',
          :description='option.description'
        )

      //- Сроки и резерв — после выбора даты: без даты считать нечего.
      .plan-form__schedule(v-if='schedule')
        .plan-form__dates
          span.plan-form__dates-label {{ datesLabel }}
          .plan-form__dates-list
            span.plan-form__date.t-mono(v-for='date in scheduleDates', :key='date') {{ date }}
        DataRow(
          v-if='amount',
          align='spread',
          :label='reserveLabel',
          :value='formatAsset2Digits(schedule.reserve_per_month)'
        )
        p.plan-form__note
          q-icon(name='savings', size='16px')
          span {{ reserveNote }}
        p.plan-form__note
          q-icon(name='description', size='16px')
          span {{ $t('marketplace.expensePlanDialog.memoNote') }}

    section.plan-form__section
      h3.plan-form__label.t-eyebrow {{ $t('marketplace.expensePlanDialog.requisitesSection') }}
      BaseInput(
        v-model='payTo',
        type='textarea',
        :rows='4',
        autogrow,
        :label='$t("marketplace.expensePlanDialog.requisitesLabel")',
        :placeholder='$t("marketplace.expensePlanDialog.requisitesPlaceholder")',
        :hint='$t("marketplace.expensePlanDialog.requisitesHint")',
        stack-label
      )

  template(#footer)
    BaseButton(variant='ghost', :disabled='saving', @click='emit("update:modelValue", false)') {{ $t('common.action.cancel') }}
    BaseButton(
      variant='primary',
      :loading='saving',
      :disabled='!canSubmit',
      @click='onSubmit'
    ) {{ $t('marketplace.expensePlanDialog.submitAction') }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Zeus } from '@coopenomics/sdk'
import { uiLocale, t as i18nT } from 'src/shared/i18n'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { BaseButton, BaseDialog, BaseInput, BaseRadioCard } from 'src/shared/ui/base'
import { AmountInput, DataRow } from 'src/shared/ui/domain'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { createExpensePlan, getExpensePlanSchedule, type ExpensePlanScheduleView } from '../api'

const props = defineProps<{ modelValue: boolean; braname: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [] }>()

const title = ref('')
const amount = ref<number | null>(null)
const dueDate = ref('')
const recurrence = ref<Zeus.ExpensePlanRecurrence>(Zeus.ExpensePlanRecurrence.NONE)
const payTo = ref('')
const saving = ref(false)
const schedule = ref<ExpensePlanScheduleView | null>(null)

// Каждое открытие — чистая форма: прошлый черновик не подмешивается к новому расходу.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    title.value = ''
    amount.value = null
    dueDate.value = ''
    recurrence.value = Zeus.ExpensePlanRecurrence.NONE
    payTo.value = ''
    schedule.value = null
  }
)

/** Дата из поля ввода — полночь UTC выбранного дня; так её получает и сервер. */
const dueAt = computed(() => (dueDate.value ? new Date(dueDate.value) : null))

function formatDay(date: Date | string): string {
  return new Date(date).toLocaleDateString(uiLocale(), { timeZone: 'UTC' })
}

const recurrenceOptions = computed(() => {
  const due = dueAt.value
  const day = due ? due.getUTCDate() : null
  const dayMonth = due ? due.toLocaleDateString(uiLocale(), { timeZone: 'UTC', day: 'numeric', month: 'long' }) : null
  return [
    {
      value: Zeus.ExpensePlanRecurrence.NONE,
      title: i18nT('marketplace.expensePlanDialog.onceTitle'),
      description: i18nT('marketplace.expensePlanDialog.onceDescription'),
    },
    {
      value: Zeus.ExpensePlanRecurrence.MONTHLY,
      title: i18nT('marketplace.expensePlanDialog.monthlyTitle'),
      description: day
        ? i18nT('marketplace.expensePlanDialog.monthlyDescription', { day: String(day) })
        : i18nT('marketplace.expensePlanDialog.monthlyDescriptionNoDate'),
    },
    {
      value: Zeus.ExpensePlanRecurrence.QUARTERLY,
      title: i18nT('marketplace.expensePlanDialog.quarterlyTitle'),
      description: i18nT('marketplace.expensePlanDialog.quarterlyDescription'),
    },
    {
      value: Zeus.ExpensePlanRecurrence.YEARLY,
      title: i18nT('marketplace.expensePlanDialog.yearlyTitle'),
      description: dayMonth
        ? i18nT('marketplace.expensePlanDialog.yearlyDescription', { date: dayMonth })
        : i18nT('marketplace.expensePlanDialog.yearlyDescriptionNoDate'),
    },
  ]
})

// Показ сроков и резерва — с сервера, по каждому изменению суммы, даты и
// повторяемости. Ответ на устаревший ввод отбрасывается по номеру запроса.
let requestSeq = 0
let scheduleTimer: ReturnType<typeof setTimeout> | null = null

async function loadSchedule(): Promise<void> {
  const due = dueAt.value
  if (!due || Number.isNaN(due.getTime())) {
    schedule.value = null
    return
  }
  const seq = ++requestSeq
  try {
    const result = await getExpensePlanSchedule({
      amount: Number(amount.value) || 0,
      due_date: due.toISOString(),
      recurrence: recurrence.value,
    })
    if (seq === requestSeq) schedule.value = result
  } catch (e) {
    if (seq === requestSeq) schedule.value = null
    FailAlert(e)
  }
}

watch([amount, dueDate, recurrence], () => {
  if (scheduleTimer) clearTimeout(scheduleTimer)
  // timing: debounce — сумма набирается по цифре, запрос показа идёт после паузы ввода.
  scheduleTimer = setTimeout(() => void loadSchedule(), 250)
})

const scheduleDates = computed(() => (schedule.value?.due_dates ?? []).map(formatDay))

const isSeries = computed(() => recurrence.value !== Zeus.ExpensePlanRecurrence.NONE)

const datesLabel = computed(() =>
  isSeries.value
    ? i18nT('marketplace.expensePlanDialog.datesLabelSeries')
    : i18nT('marketplace.expensePlanDialog.datesLabelOnce')
)

const reserveMonths = computed(() => schedule.value?.reserve_months ?? 1)

const reserveLabel = computed(() =>
  reserveMonths.value > 1
    ? i18nT('marketplace.expensePlanDialog.reservePerMonthLabel')
    : i18nT('marketplace.expensePlanDialog.reserveWholeLabel')
)

const reserveNote = computed(() => {
  if (reserveMonths.value > 1) return i18nT('marketplace.expensePlanDialog.reserveNoteSpread', { months: String(reserveMonths.value) })
  if (recurrence.value === Zeus.ExpensePlanRecurrence.MONTHLY) return i18nT('marketplace.expensePlanDialog.reserveNoteMonthly')
  return i18nT('marketplace.expensePlanDialog.reserveNoteOnce')
})

const canSubmit = computed(() => !!title.value.trim() && Number(amount.value) > 0 && !!dueAt.value && !saving.value)

async function onSubmit(): Promise<void> {
  const due = dueAt.value
  const sum = Number(amount.value)
  if (!props.braname || !title.value.trim() || !due || !Number.isFinite(sum) || sum <= 0) return
  saving.value = true
  try {
    await createExpensePlan({
      braname: props.braname,
      title: title.value.trim(),
      amount: sum,
      recurrence: recurrence.value,
      due_date: due.toISOString(),
      pay_to: payTo.value.trim() || '—',
    })
    SuccessAlert(i18nT('marketplace.operatorBranchEconomyPage.expenseAddedMessage'))
    emit('created')
    emit('update:modelValue', false)
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorBranchEconomyPage.addExpenseFailedMessage'))
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.plan-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  min-width: 0;
}

.plan-form__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-4) var(--p-5);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
  min-width: 0;
}

.plan-form__label {
  margin: 0;
  color: var(--p-ink-3);
}

.plan-form__pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--p-3);
}

.plan-form__choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--p-2);
}

.plan-form__schedule {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  padding: var(--p-3) var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
}

.plan-form__dates {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--p-3);
  flex-wrap: wrap;
}

.plan-form__dates-label {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}

.plan-form__dates-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--p-1);
}

.plan-form__date {
  padding: var(--p-1) var(--p-2);
  border-radius: var(--p-r-pill);
  background: var(--p-surface-3);
  color: var(--p-ink);
  font-size: var(--p-fs-body-sm);
}

.plan-form__note {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2);
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-3);

  .q-icon {
    flex: none;
    color: var(--p-ink-3);
  }
}

@media (max-width: 600px) {
  .plan-form__section {
    padding: var(--p-3) var(--p-4);
  }

  .plan-form__pair,
  .plan-form__choices {
    grid-template-columns: 1fr;
  }
}
</style>
