<template lang="pug">
//- Новый плановый расход участка (задача 99D-34, решение владельца 11.11.2026).
//-
//- Зоны: слева — что и когда платим (назначение, сумма, срок, повторяемость,
//- реквизиты), справа — что из этого выйдет (план платежей: сумма за платёж,
//- ближайшие сроки, резерв участка в месяц и как он формируется). План
//- считает сервер тем же календарём, по которому реестр продолжает серию, а
//- итог месяца собирает резерв: панель обещает ровно то, что произойдёт.
//- На узком экране панель плана встаёт под форму.
BaseDialog(
  :model-value='modelValue',
  :title='$t("marketplace.expensePlanDialog.title")',
  size='xl',
  @update:model-value='emit("update:modelValue", $event)'
)
  .plan-dialog
    .plan-dialog__form
      BaseInput(
        v-model='title',
        :label='$t("marketplace.expensePlanDialog.purposeLabel")',
        :placeholder='$t("marketplace.expensePlanDialog.purposePlaceholder")',
        stack-label,
        required
      )
      .plan-dialog__pair
        AmountInput(
          v-model='amount',
          :label='$t("marketplace.expensePlanDialog.amountLabel")',
          :placeholder='$t("marketplace.expensePlanDialog.amountPlaceholder")',
          :precision='2',
          :min='0',
          stack-label
        )
        BaseInput(
          v-model='dueDate',
          type='date',
          :label='$t("marketplace.expensePlanDialog.dueDateLabel")',
          stack-label,
          required
        )

      //- Повторяемость — один ряд сегментов: выбор из четырёх читается разом,
      //- пояснение выбранного варианта — одной строкой под рядом.
      .plan-dialog__field
        span.plan-dialog__label#plan-recurrence-label {{ $t('marketplace.expensePlanDialog.recurrenceLabel') }}
        BaseSegmented(
          v-model='recurrence',
          :options='recurrenceOptions',
          aria-labelledby='plan-recurrence-label'
        )
        span.plan-dialog__caption {{ selectedOption.description }}

      //- Способ оплаты задаётся сразу (задача 99D-35): «Оплатить» потом только
      //- подписывает готовую записку. Организации платят по реквизитам из
      //- реестра контрагентов, пайщику — аванс под отчёт на его реквизиты.
      .plan-dialog__field
        span.plan-dialog__label#plan-payee-label {{ $t('marketplace.expensePlanDialog.payeeLabel') }}
        BaseSegmented(
          v-model='payee',
          :options='payeeOptions',
          aria-labelledby='plan-payee-label'
        )
        span.plan-dialog__caption {{ payee === PAYEE_ORG ? $t('marketplace.expensePlanDialog.payeeOrgCaption') : $t('marketplace.expensePlanDialog.payeeAdvanceCaption') }}

      template(v-if='payee === PAYEE_ORG')
        ExpenseCounterpartySelect(
          v-model='counterpartyId',
          :braname='braname',
          @selected='onCounterparty'
        )
        BaseInput(
          v-model='paymentPurpose',
          type='textarea',
          :rows='2',
          autogrow,
          :label='$t("marketplace.expensePlanDialog.purposeLabel")',
          :hint='$t("marketplace.expensePlanDialog.purposeHint")',
          stack-label,
          required
        )

      template(v-else)
        BaseSegmented(
          v-model='advanceTo',
          :options='advanceOptions',
          :aria-label='$t("marketplace.expensePlanDialog.advanceToLabel")'
        )
        UserSearchSelector(
          v-if='advanceTo === Zeus.ExpenseRecipientType.MEMBER',
          v-model='memberAccount',
          :label='$t("marketplace.expensePlanDialog.memberLabel")',
          :types='["individual"]',
          outlined
        )
        PaymentMethodSelect(
          v-if='advanceUsername',
          v-model='paymentMethodId',
          :username='advanceUsername',
          required
        )

    //- План платежей: сумма за платёж крупно, под ней лента сроков, внизу
    //- резерв и правило записки. Без срока считать нечего — панель подсказывает.
    aside.plan-dialog__plan(aria-live='polite')
      .plan-dialog__plan-head
        q-icon(name='event_repeat', size='18px')
        span {{ $t('marketplace.expensePlanDialog.planTitle') }}

      .plan-dialog__sum
        span.plan-dialog__sum-value.t-mono {{ amountLabel }}
        span.plan-dialog__sum-note {{ isSeries ? $t('marketplace.expensePlanDialog.perPayment') : $t('marketplace.expensePlanDialog.perOnce') }}

      //- Получатель — кому перечисляется каждый платёж серии.
      .plan-dialog__payee
        span.plan-dialog__payee-label {{ $t('marketplace.expensePlanDialog.planPayee') }}
        span.plan-dialog__payee-name {{ payeeTitle || $t('marketplace.expensePlanDialog.planPayeeEmpty') }}
        span.plan-dialog__payee-note(v-if='payeeNote') {{ payeeNote }}

      template(v-if='schedule')
        TransitionGroup.plan-dialog__timeline(name='plan-step', tag='ol')
          li.plan-dialog__step(
            v-for='(step, index) in steps',
            :key='step.key',
            :class='{ "plan-dialog__step--first": index === 0 }'
          )
            span.plan-dialog__step-date.t-mono {{ step.date }}
            span.plan-dialog__step-note {{ step.note }}

        .plan-dialog__reserve
          DataRow(
            align='spread',
            :label='reserveLabel',
            :value='reserveValue'
          )
          p.plan-dialog__note {{ reserveNote }}

      .plan-dialog__empty(v-else)
        q-icon(name='edit_calendar', size='28px')
        span {{ $t('marketplace.expensePlanDialog.planEmpty') }}

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
import { BaseButton, BaseDialog, BaseInput, BaseSegmented } from 'src/shared/ui/base'
import { AmountInput, DataRow, ExpenseCounterpartySelect, PaymentMethodSelect } from 'src/shared/ui/domain'
import { UserSearchSelector } from 'src/shared/ui/UserSearchSelector'
import { useSessionStore } from 'src/entities/Session'
import type { ExpenseCounterpartyView } from 'src/shared/lib/expenses/counterparties'
import { formatAsset2Digits, splitAsset2Digits } from 'src/shared/lib/utils'
import { createExpensePlan, getExpensePlanSchedule, type ExpensePlanScheduleView } from '../api'

const props = defineProps<{ modelValue: boolean; braname: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [] }>()

/** Шаг серии в месяцах — для подписи «через N мес.» в ленте сроков. */
const STEP_MONTHS: Record<Zeus.ExpensePlanRecurrence, number> = {
  [Zeus.ExpensePlanRecurrence.NONE]: 0,
  [Zeus.ExpensePlanRecurrence.MONTHLY]: 1,
  [Zeus.ExpensePlanRecurrence.QUARTERLY]: 3,
  [Zeus.ExpensePlanRecurrence.YEARLY]: 12,
}

const title = ref('')
const amount = ref<number | null>(null)
const dueDate = ref('')
const recurrence = ref<Zeus.ExpensePlanRecurrence>(Zeus.ExpensePlanRecurrence.NONE)
/** Способ оплаты: организации по реквизитам или аванс под отчёт пайщику. */
const PAYEE_ORG = 'ORG'
const PAYEE_ADVANCE = 'ADVANCE'
const payee = ref<string>(PAYEE_ORG)
const counterpartyId = ref<number | null>(null)
const counterparty = ref<ExpenseCounterpartyView | null>(null)
const paymentPurpose = ref('')
const advanceTo = ref<Zeus.ExpenseRecipientType>(Zeus.ExpenseRecipientType.SELF)
const memberAccount = ref('')
const paymentMethodId = ref<string | null>(null)
const session = useSessionStore()
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
    payee.value = PAYEE_ORG
    counterpartyId.value = null
    counterparty.value = null
    paymentPurpose.value = ''
    advanceTo.value = Zeus.ExpenseRecipientType.SELF
    memberAccount.value = ''
    paymentMethodId.value = null
    schedule.value = null
  }
)

/** Дата из поля ввода — полночь UTC выбранного дня; так её получает и сервер. */
const dueAt = computed(() => {
  if (!dueDate.value) return null
  const date = new Date(dueDate.value)
  return Number.isNaN(date.getTime()) ? null : date
})

function formatDay(date: Date | string): string {
  return new Date(date).toLocaleDateString(uiLocale(), { timeZone: 'UTC' })
}

const recurrenceOptions = computed(() => {
  const due = dueAt.value
  const day = due ? String(due.getUTCDate()) : null
  const dayMonth = due ? due.toLocaleDateString(uiLocale(), { timeZone: 'UTC', day: 'numeric', month: 'long' }) : null
  return [
    {
      value: Zeus.ExpensePlanRecurrence.NONE,
      label: i18nT('marketplace.expensePlanDialog.onceTitle'),
      description: i18nT('marketplace.expensePlanDialog.onceDescription'),
    },
    {
      value: Zeus.ExpensePlanRecurrence.MONTHLY,
      label: i18nT('marketplace.expensePlanDialog.monthlyTitle'),
      description: day
        ? i18nT('marketplace.expensePlanDialog.monthlyDescription', { day })
        : i18nT('marketplace.expensePlanDialog.monthlyDescriptionNoDate'),
    },
    {
      value: Zeus.ExpensePlanRecurrence.QUARTERLY,
      label: i18nT('marketplace.expensePlanDialog.quarterlyTitle'),
      description: i18nT('marketplace.expensePlanDialog.quarterlyDescription'),
    },
    {
      value: Zeus.ExpensePlanRecurrence.YEARLY,
      label: i18nT('marketplace.expensePlanDialog.yearlyTitle'),
      description: dayMonth
        ? i18nT('marketplace.expensePlanDialog.yearlyDescription', { date: dayMonth })
        : i18nT('marketplace.expensePlanDialog.yearlyDescriptionNoDate'),
    },
  ]
})

const selectedOption = computed(
  () => recurrenceOptions.value.find((o) => o.value === recurrence.value) ?? recurrenceOptions.value[0]
)

const payeeOptions = [
  { value: PAYEE_ORG, label: i18nT('marketplace.expensePlanDialog.payeeOrg') },
  { value: PAYEE_ADVANCE, label: i18nT('marketplace.expensePlanDialog.payeeAdvance') },
]

const advanceOptions = [
  { value: Zeus.ExpenseRecipientType.SELF, label: i18nT('marketplace.expensePlanDialog.advanceSelf') },
  { value: Zeus.ExpenseRecipientType.MEMBER, label: i18nT('marketplace.expensePlanDialog.advanceMember') },
]

/** Чей способ получения средств выбирается: свой или выбранного пайщика. */
const advanceUsername = computed(() =>
  advanceTo.value === Zeus.ExpenseRecipientType.SELF ? session.username : memberAccount.value.trim()
)

// Другой получатель — другой список способов получения средств: прежний выбор сбрасывается.
watch(advanceUsername, () => {
  paymentMethodId.value = null
})

/** Назначение платежа по умолчанию — из карточки контрагента, пока председатель не ввёл своё. */
function onCounterparty(cp: ExpenseCounterpartyView | null): void {
  const previousDefault = counterparty.value?.payment_purpose ?? ''
  counterparty.value = cp
  if (!paymentPurpose.value.trim() || paymentPurpose.value === previousDefault) {
    paymentPurpose.value = cp?.payment_purpose ?? ''
  }
}

const payeeTitle = computed(() => {
  if (payee.value === PAYEE_ORG) return counterparty.value?.name ?? ''
  return advanceTo.value === Zeus.ExpenseRecipientType.SELF ? i18nT('marketplace.expensePlanDialog.advanceSelfTitle') : memberAccount.value.trim()
})

const payeeNote = computed(() => {
  if (payee.value === PAYEE_ORG) return counterparty.value ? paymentPurpose.value.trim() : ''
  return i18nT('marketplace.expensePlanDialog.planPayeeAdvance')
})

const payeeReady = computed(() =>
  payee.value === PAYEE_ORG
    ? !!counterpartyId.value && !!paymentPurpose.value.trim()
    : !!advanceUsername.value && !!paymentMethodId.value
)

const isSeries = computed(() => recurrence.value !== Zeus.ExpensePlanRecurrence.NONE)

// План с сервера — по каждому изменению суммы, даты и повторяемости. Ответ
// на устаревший ввод отбрасывается по номеру запроса.
let requestSeq = 0
let scheduleTimer: ReturnType<typeof setTimeout> | null = null

async function loadSchedule(): Promise<void> {
  const due = dueAt.value
  const seq = ++requestSeq
  if (!due) {
    schedule.value = null
    return
  }
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
  // timing: debounce — сумма набирается по цифре, запрос плана идёт после паузы ввода.
  scheduleTimer = setTimeout(() => void loadSchedule(), 250)
})

/** Валюта кооператива — из ответа сервера; до ответа суммы показываются без знака. */
const symbol = computed(() => (schedule.value ? splitAsset2Digits(schedule.value.reserve_per_month).symbol : ''))

const amountLabel = computed(() => {
  const value = Number(amount.value) || 0
  const formatted = value.toLocaleString(uiLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return symbol.value ? `${formatted} ${symbol.value}` : formatted
})

const steps = computed(() => {
  const dates = schedule.value?.due_dates ?? []
  const step = STEP_MONTHS[recurrence.value]
  return dates.map((date, index) => ({
    key: `${recurrence.value}:${String(date)}`,
    date: formatDay(date),
    note:
      index === 0
        ? isSeries.value
          ? i18nT('marketplace.expensePlanDialog.firstPayment')
          : i18nT('marketplace.expensePlanDialog.onlyPayment')
        : i18nT('marketplace.expensePlanDialog.paymentIn', { months: String(step * index) }),
  }))
})

const reserveMonths = computed(() => schedule.value?.reserve_months ?? 1)

const reserveLabel = computed(() =>
  reserveMonths.value > 1
    ? i18nT('marketplace.expensePlanDialog.reservePerMonthLabel')
    : i18nT('marketplace.expensePlanDialog.reserveWholeLabel')
)

const reserveValue = computed(() => (Number(amount.value) > 0 && schedule.value ? formatAsset2Digits(schedule.value.reserve_per_month) : '—'))

const reserveNote = computed(() => {
  if (reserveMonths.value === 3) return i18nT('marketplace.expensePlanDialog.reserveNoteQuarter')
  if (reserveMonths.value === 12) return i18nT('marketplace.expensePlanDialog.reserveNoteYear')
  if (reserveMonths.value > 1) return i18nT('marketplace.expensePlanDialog.reserveNoteSpread', { months: String(reserveMonths.value) })
  if (recurrence.value === Zeus.ExpensePlanRecurrence.MONTHLY) return i18nT('marketplace.expensePlanDialog.reserveNoteMonthly')
  return i18nT('marketplace.expensePlanDialog.reserveNoteOnce')
})

/** Способ оплаты для записи плана: контрагент с назначением либо пайщик со способом получения средств. */
function payeeInput() {
  if (payee.value === PAYEE_ORG) {
    return {
      recipient_type: Zeus.ExpenseRecipientType.ORG,
      counterparty_id: counterpartyId.value ?? undefined,
      payment_purpose: paymentPurpose.value.trim(),
    }
  }
  return {
    recipient_type: advanceTo.value,
    recipient: advanceTo.value === Zeus.ExpenseRecipientType.MEMBER ? memberAccount.value.trim() : undefined,
    payment_method_id: paymentMethodId.value ?? undefined,
  }
}

const canSubmit = computed(
  () => !!title.value.trim() && Number(amount.value) > 0 && !!dueAt.value && payeeReady.value && !saving.value
)

async function onSubmit(): Promise<void> {
  const due = dueAt.value
  const sum = Number(amount.value)
  if (!canSubmit.value || !props.braname || !due) return
  saving.value = true
  try {
    await createExpensePlan({
      braname: props.braname,
      title: title.value.trim(),
      amount: sum,
      recurrence: recurrence.value,
      due_date: due.toISOString(),
      ...payeeInput(),
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
// Две колонки: форма тянется, план — постоянной ширины. Между ними — воздух,
// а не рамка: план отделён своей мягкой подложкой.
.plan-dialog {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 17rem);
  gap: var(--p-6);
  align-items: start;
  min-width: 0;
}

.plan-dialog__form {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  min-width: 0;
}

.plan-dialog__pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--p-3);
}

.plan-dialog__field {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  margin-bottom: var(--p-4);
}

.plan-dialog__label {
  font-size: var(--p-fs-body-sm);
  font-weight: 500;
  color: var(--p-ink-2);
}

.plan-dialog__caption {
  min-height: calc(var(--p-fs-body-sm) * var(--p-lh-body-sm) * 2);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}

// План платежей — плоская карточка канона: белая поверхность, волосяная рамка, без тени.
.plan-dialog__plan {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  padding: var(--p-5);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg);
  background: var(--p-surface);
  min-width: 0;
}

.plan-dialog__plan-head {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink-2);

  .q-icon {
    color: var(--p-primary);
  }
}

.plan-dialog__sum {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.plan-dialog__sum-value {
  font-size: var(--p-fs-h1);
  font-weight: 700;
  line-height: var(--p-lh-h1);
  letter-spacing: var(--p-ls-h1);
  color: var(--p-ink);
  overflow-wrap: anywhere;
}

.plan-dialog__payee {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}

.plan-dialog__payee-label {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-3);
}

.plan-dialog__payee-name {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
  overflow-wrap: anywhere;
}

.plan-dialog__payee-note {
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
  white-space: pre-line;
}

.plan-dialog__sum-note {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}

// Лента сроков: точка на тонкой вертикали, первая точка — цветом акцента.
.plan-dialog__timeline {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  margin: 0;
  padding: 0 0 0 var(--p-5);
  list-style: none;

  &::before {
    content: '';
    position: absolute;
    top: var(--p-2);
    bottom: var(--p-2);
    left: 5px;
    border-left: 1px solid var(--p-line-2);
  }
}

.plan-dialog__step {
  position: relative;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--p-3);

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: calc(-1 * var(--p-5));
    width: 11px;
    height: 11px;
    margin-top: -5px;
    border: 1px solid var(--p-line-2);
    border-radius: 50%;
    background: var(--p-surface);
  }
}

.plan-dialog__step--first::before {
  border-color: var(--p-primary);
  background: var(--p-primary);
}

.plan-dialog__step-date {
  font-size: var(--p-fs-body);
  color: var(--p-ink);
}

.plan-dialog__step--first .plan-dialog__step-date {
  font-weight: 600;
}

.plan-dialog__step-note {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
  white-space: nowrap;
}

.plan-step-enter-active,
.plan-step-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.plan-step-enter-from,
.plan-step-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.plan-step-leave-active {
  position: absolute;
}

.plan-dialog__reserve {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}

.plan-dialog__note {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body);
  color: var(--p-ink-2);
}

.plan-dialog__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-2);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-3);

  .q-icon {
    color: var(--p-ink-3);
  }
}

@media (max-width: 760px) {
  .plan-dialog {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--p-4);
  }

}

@media (max-width: 480px) {
  .plan-dialog__pair {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .plan-step-enter-active,
  .plan-step-leave-active {
    transition: none;
  }
}
</style>
