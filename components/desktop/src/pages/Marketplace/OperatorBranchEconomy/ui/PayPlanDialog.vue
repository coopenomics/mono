<template lang="pug">
//- Оплата планового расхода (задача 99D-35): способ оплаты задан в записи
//- плана, поэтому записка собирается без повторного ввода — председатель
//- читает её текст и подписывает. Сервер сверяет записку с записью плана:
//- сумму, получателя, контрагента и назначение либо способ получения средств.
BaseDialog(
  :model-value='modelValue',
  :title='$t("marketplace.payPlanDialog.title")',
  size='xl',
  @update:model-value='emit("update:modelValue", $event)'
)
  .pay-plan
    .pay-plan__summary(v-if='plan')
      .pay-plan__fact
        span.pay-plan__label {{ $t('marketplace.payPlanDialog.amountLabel') }}
        span.pay-plan__amount.t-mono {{ formatAsset2Digits(plan.amount) }}
      .pay-plan__fact
        span.pay-plan__label {{ $t('marketplace.payPlanDialog.payeeLabel') }}
        span.pay-plan__value {{ payeeTitle }}
        span.pay-plan__note {{ payeeNote }}
      .pay-plan__fact
        span.pay-plan__label {{ $t('marketplace.payPlanDialog.dueLabel') }}
        span.pay-plan__value {{ dueLabel }}

    DocumentPreview(
      :document='{ type: "html", html: generated?.html ?? "" }',
      :loading='generating',
      :error='generateError',
      profile='document',
      height='420px'
    )

  template(#footer)
    BaseButton(variant='ghost', :disabled='signing', @click='emit("update:modelValue", false)') {{ $t('common.action.cancel') }}
    BaseButton(
      variant='primary',
      :loading='signing',
      :disabled='!generated || generating',
      @click='onSign'
    ) {{ $t('marketplace.payPlanDialog.signAction') }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Zeus } from '@coopenomics/sdk'
import { uiLocale, t as i18nT } from 'src/shared/i18n'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useSessionStore } from 'src/entities/Session'
import { useSystemStore } from 'src/entities/System/model'
import { DigitalDocument } from 'src/shared/lib/document'
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { BaseButton, BaseDialog } from 'src/shared/ui/base'
import { DocumentPreview } from 'src/shared/ui/domain'
import {
  formatStatementDeadline,
  generateExpenseItemHash,
  generateExpenseStatement,
  type GeneratedExpenseStatement,
} from 'src/shared/lib/expenses/statement'
import { listExpenseCounterparties } from 'src/shared/lib/expenses/counterparties'
import { createBranchExpense, type ExpensePlanView, type ICreateBranchExpenseInput } from '../api'

const props = defineProps<{
  modelValue: boolean
  plan: ExpensePlanView | null
  braname: string
  /** Пул расходов участка — источник средств записки. */
  sourceWallet: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean]; paid: [] }>()

const session = useSessionStore()
const system = useSystemStore()

const generated = ref<GeneratedExpenseStatement | null>(null)
const generating = ref(false)
const generateError = ref<string | undefined>(undefined)
const signing = ref(false)
const expenseHash = ref('')
/** Реквизиты контрагента текстом — сервер сверит их с карточкой при подаче. */
const counterpartyRequisites = ref('')

const isOrg = computed(() => props.plan?.recipient_type === Zeus.ExpenseRecipientType.ORG)

const payeeTitle = computed(() => {
  const plan = props.plan
  if (!plan) return ''
  if (isOrg.value) return plan.counterparty_name ?? ''
  return plan.recipient_name ?? plan.recipient ?? ''
})

const payeeNote = computed(() =>
  isOrg.value ? props.plan?.payment_purpose ?? '' : i18nT('marketplace.payPlanDialog.advanceNote')
)

/** Срок записи — дата по UTC, как её ввёл председатель. */
const dueIso = computed(() => (props.plan?.due_date ? new Date(String(props.plan.due_date)).toISOString().slice(0, 10) : ''))
const dueLabel = computed(() =>
  props.plan?.due_date ? new Date(String(props.plan.due_date)).toLocaleDateString(uiLocale(), { timeZone: 'UTC' }) : '—'
)

const mechanics = computed(() => (isOrg.value ? Zeus.ExpenseMechanics.DIRECT : Zeus.ExpenseMechanics.ADVANCE))

watch(
  () => props.modelValue,
  (open) => {
    if (open) void prepare()
    else generated.value = null
  }
)

/** Получатель-организация: контрагент, его наименование и реквизиты, назначение платежа. */
function orgParty(plan: ExpensePlanView) {
  return {
    recipient: '',
    recipient_name: plan.counterparty_name ?? '',
    requisites: counterpartyRequisites.value,
    payment_purpose: plan.payment_purpose ?? undefined,
    counterparty_id: plan.counterparty_id ?? undefined,
  }
}

/** Получатель-пайщик аванса: аккаунт и способ получения средств. */
function advanceParty(plan: ExpensePlanView) {
  return {
    recipient: plan.recipient ?? session.username,
    payment_method_id: plan.payment_method_id ?? undefined,
  }
}

/** Пункт документа записки: сервер подставит реквизиты контрагента или пайщика. */
function statementItem(plan: ExpensePlanView) {
  const { recipient, ...party } = isOrg.value ? orgParty(plan) : advanceParty(plan)
  return {
    number: '1',
    description: plan.title,
    amount: plan.amount,
    recipient_type: plan.recipient_type as Zeus.ExpenseRecipientType,
    mechanics: mechanics.value,
    recipient_username: plan.recipient_type === Zeus.ExpenseRecipientType.MEMBER ? recipient : undefined,
    ...party,
  }
}

/** Пункт записки для цепи — тот же платёж, что в документе; сервер сверит его с записью плана. */
function chainItem(plan: ExpensePlanView) {
  return {
    item_hash: generateExpenseItemHash(expenseHash.value, 0),
    mechanics: mechanics.value,
    recipient_type: plan.recipient_type as Zeus.ExpenseRecipientType,
    description: plan.title,
    planned_amount: plan.amount,
    ...(isOrg.value ? orgParty(plan) : advanceParty(plan)),
  }
}

/** Текст записки из записи плана: один пункт — один платёж серии. */
async function prepare(): Promise<void> {
  const plan = props.plan
  if (!plan?.recipient_type) return
  generating.value = true
  generateError.value = undefined
  generated.value = null
  try {
    expenseHash.value = await generateUniqueHash()
    counterpartyRequisites.value = ''
    if (isOrg.value) {
      const counterparties = await listExpenseCounterparties({ include_archived: true })
      counterpartyRequisites.value = counterparties.find((c) => c.id === plan.counterparty_id)?.requisites_text ?? ''
    }
    generated.value = await generateExpenseStatement({
      coopname: system.info.coopname,
      username: session.username,
      proposal_hash: expenseHash.value,
      proposal: {
        description: plan.title,
        total_amount: plan.amount,
        items_count: 1,
        source_wallet: props.sourceWallet,
        deadline: formatStatementDeadline(dueIso.value),
      },
      items: [statementItem(plan)],
    })
  } catch (e) {
    generateError.value = e instanceof Error ? e.message : String(e)
  } finally {
    generating.value = false
  }
}

async function onSign(): Promise<void> {
  const plan = props.plan
  if (!plan?.recipient_type || !generated.value) return
  signing.value = true
  try {
    const signed = await new DigitalDocument(generated.value).sign(session.username, 1)
    await createBranchExpense({
      braname: props.braname,
      expense_hash: expenseHash.value,
      plan_id: plan.id,
      // Подписанный документ общий для потребителей шасси — структура задаётся схемой мутации.
      statement: signed as unknown as ICreateBranchExpenseInput['statement'],
      items: [chainItem(plan)],
    })
    SuccessAlert(i18nT('marketplace.operatorBranchEconomyPage.expenseSentToCouncilMessage'))
    emit('paid')
    emit('update:modelValue', false)
  } catch (e) {
    FailAlert(e)
  } finally {
    signing.value = false
  }
}
</script>

<style lang="scss" scoped>
.pay-plan {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}

// Суть платежа — тремя фактами в ряд над текстом записки: сумма, получатель, срок.
.pay-plan__summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--p-6);
  padding: var(--p-4) var(--p-5);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg);
  background: var(--p-surface);
}

.pay-plan__fact {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}

.pay-plan__label {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-3);
}

.pay-plan__amount {
  font-size: var(--p-fs-h2);
  font-weight: 700;
  color: var(--p-ink);
}

.pay-plan__value {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
  overflow-wrap: anywhere;
}

.pay-plan__note {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}

@media (max-width: 760px) {
  .pay-plan__summary {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--p-3);
  }
}
</style>
