<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useSessionStore } from 'src/entities/Session'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { DigitalDocument } from 'src/shared/lib/document'
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseInput, BaseSelect, EmptyState, TableSkeleton } from 'src/shared/ui/base'
import type { BaseBadgeVariant, TableSkeletonColumn } from 'src/shared/ui/base'
import { AmountInput, PageHint, WalletCard } from 'src/shared/ui/domain'
import { ExpenseCreateDialog, type ExpenseCreatePayload } from 'src/shared/ui/domain/ExpenseCreateDialog'
import { PaymentMethodSelect } from 'src/shared/ui/domain/PaymentMethodSelect'
import { PageTabs, type PageTab } from 'src/shared/ui/layout'
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { operationLabel, formatProcessAmount } from 'src/shared/lib/ledger2'
import { paymentStatusLabel, paymentStatusVariant } from 'src/shared/lib/payment'
import {
  type ExpensePlanView,
  type MarketplaceAidView,
  type MarketplaceBranchEconomyView,
  type MarketplaceBranchWalletHistoryView,
  type MarketplacePersonalWalletHistoryView,
  convertBranchFunds,
  createAid,
  createBranchExpense,
  type ICreateBranchExpenseInput,
  createExpensePlan,
  deleteExpensePlan,
  deleteTrusteeWeight,
  distributeBranchFunds,
  getAidStatementSignablePayload,
  getBranchEconomy,
  getBranchWalletHistory,
  getPersonalEconomy,
  getPersonalWalletHistory,
  listAids,
  listExpensePlans,
  setTrusteeWeight,
} from '../api'

/**
 * Стол ПВЗ → «Экономика участка» (requirement b6, раунд 5 — приоритет
 * общего кошелька). Зоны:
 *
 *  1. «Мои средства» — персональный кошелёк членских средств текущего
 *     оператора: перевод в членский кошелёк Стола заказов (заказы себе)
 *     либо материальная помощь (заявление → выплата кассиром, НДФЛ
 *     получатель платит сам).
 *  2. «Общий кошелёк участка» — сюда приходит 100% членских взносов
 *     исполненных заказов; показатели «Резерв на 30 дней» и «Доступно к
 *     распределению».
 *  3. «Плановые расходы» — реестр предстоящих трат (записи со сроком в
 *     ближайшие 30 дней образуют резерв); регулярные расходы система
 *     добавляет сама. Оплата идёт через шасси расходов: служебная записка →
 *     решение совета → оплата по реквизитам либо аванс под отчёт.
 *  4. «Распределение» — веса участников и ручная команда «Распределить»
 *     (председатель, сумма из общего кошелька сверх резерва).
 */

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const store = useOperatorBranchStore()

const coopname = computed(() => String(route.params.coopname ?? ''))
const braname = computed(() => store.activeBraname ?? '')
const branch = computed(() => store.activeBranch?.branch ?? null)
const isBranchTrustee = computed(
  () => !!branch.value && branch.value.trustee.username === session.username
)

const loading = ref(true)
const economy = ref<MarketplaceBranchEconomyView | null>(null)
const plans = ref<ExpensePlanView[]>([])
const personalBalance = ref('')
const aids = ref<MarketplaceAidView[]>([])
const walletHistory = ref<MarketplaceBranchWalletHistoryView['items']>([])
const personalWalletHistory = ref<MarketplacePersonalWalletHistoryView['items']>([])

// ─── Табы страницы (requirement — переверстка без изменения логики) ───

const activeKey = ref<'wallet' | 'expenses' | 'distribution' | 'personal'>('wallet')

const tabs = computed<PageTab[]>(() => [
  { key: 'wallet', label: 'Кошелёк участка' },
  { key: 'expenses', label: 'Плановые расходы', count: plans.value.length || undefined },
  { key: 'distribution', label: 'Распределение', count: economy.value?.weights.length || undefined },
  { key: 'personal', label: 'Мои средства' },
])

function onSelectTab(tab: PageTab): void {
  activeKey.value = tab.key as typeof activeKey.value
}

// Переход из движения кошелька прямо на страницу заказа участка — там
// состояние, документы и операции процесса поставки.
function goToOrder(orderId: string): void {
  void router.push({
    name: 'marketplace-pvz-order-detail',
    params: { coopname: coopname.value, orderId },
  })
}

function assetAmount(asset: string): number {
  return Number.parseFloat(asset?.split(' ')[0] ?? '0') || 0
}

function assetSymbol(asset: string): string {
  return asset?.split(' ')[1] ?? ''
}

// Заявление на матпомощь проходит две стадии: сперва рассмотрение советом
// (выплата денег из кооператива — его компетенция), затем выплату кассиром.
// Пока совет не решил, статус платежа получателю ничего не говорит — кассир
// заявку ещё не видит; после одобрения показываем общий словарь статусов
// src/shared/lib/payment (тот же, что у стола кассира — ListOfPaymentsWidget).
function aidStageLabel(aid: MarketplaceAidView): string {
  if (aid.stage === 'ON_COUNCIL') return 'На рассмотрении совета'
  return paymentStatusLabel(aid.payment_status)
}

function aidStageVariant(aid: MarketplaceAidView): BaseBadgeVariant {
  if (aid.stage === 'ON_COUNCIL') return 'info'
  return paymentStatusVariant(aid.payment_status)
}

function personName(p: { first_name?: string; last_name?: string; middle_name?: string; username: string } | undefined): string {
  if (!p) return ''
  const full = [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(' ').trim()
  return full || p.username
}

const nameByUsername = computed<Record<string, string>>(() => {
  const b = branch.value
  if (!b) return {}
  const map: Record<string, string> = { [b.trustee.username]: personName(b.trustee) }
  for (const t of b.trusted) map[t.username] = personName(t)
  return map
})

async function loadAll(): Promise<void> {
  if (!braname.value) return
  loading.value = true
  try {
    const [branchEconomy, branchPlans, personal, myAids, history, personalHistory] = await Promise.all([
      getBranchEconomy(braname.value),
      listExpensePlans(braname.value),
      getPersonalEconomy(),
      listAids(),
      getBranchWalletHistory(braname.value, { page: 1, limit: 20, sortOrder: 'DESC' }),
      getPersonalWalletHistory({ page: 1, limit: 20, sortOrder: 'DESC' }),
    ])
    economy.value = branchEconomy
    plans.value = branchPlans
    personalBalance.value = personal.personal_balance
    aids.value = myAids
    walletHistory.value = history.items
    personalWalletHistory.value = personalHistory.items
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить экономику участка')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await store.ensureLoaded(coopname.value)
  void loadAll()
})

watch(braname, () => void loadAll())

// ─── Ручное распределение из общего кошелька (председатель КУ) ───

const distributeOpen = ref(false)
const distributeAmount = ref<number | null>(null)
const distributing = ref(false)
const availableToDistribute = computed(() =>
  economy.value ? assetAmount(economy.value.available_to_distribute) : 0
)

async function onDistribute(): Promise<void> {
  const amount = Number(distributeAmount.value)
  if (!braname.value || !Number.isFinite(amount) || amount <= 0) return
  distributing.value = true
  try {
    await distributeBranchFunds({ braname: braname.value, amount })
    SuccessAlert('Средства распределены между участниками по весам')
    distributeOpen.value = false
    distributeAmount.value = null
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось распределить средства')
  } finally {
    distributing.value = false
  }
}

// ─── Движения по общему кошельку (ledger2 через inter-порт) ───

const historyColumns = computed<TableSkeletonColumn[]>(() => [
  { label: 'Дата' },
  { label: 'Операция' },
  { label: 'Сумма', class: 'col-num' },
  { label: 'Назначение' },
])

// ─── Плановые расходы участка (оффчейн-реестр; резерв 30 дней) ───

const planColumns = computed<TableSkeletonColumn[]>(() => [
  { label: 'Назначение' },
  { label: 'Сумма', class: 'col-num' },
  { label: 'Срок' },
  { label: 'Реквизиты' },
  ...(store.isOperator ? [{ label: '', class: 'col-action', cell: 'icon' as const }] : []),
])

// Приоритетов у расхода нет: всё, что заведено в реестр, подлежит оплате.
// Единственная ось — регулярность: разовая трата или повторяющаяся.
const planRecurrenceOptions = [
  { label: 'Разовый', value: Zeus.ExpensePlanRecurrence.NONE },
  { label: 'Каждый месяц', value: Zeus.ExpensePlanRecurrence.MONTHLY },
  { label: 'Раз в квартал', value: Zeus.ExpensePlanRecurrence.QUARTERLY },
  { label: 'Раз в год', value: Zeus.ExpensePlanRecurrence.YEARLY },
]

const RECURRENCE_LABELS: Record<string, string> = {
  [Zeus.ExpensePlanRecurrence.MONTHLY]: 'ежемесячно',
  [Zeus.ExpensePlanRecurrence.QUARTERLY]: 'ежеквартально',
  [Zeus.ExpensePlanRecurrence.YEARLY]: 'ежегодно',
}

const planTitle = ref('')
const planAmount = ref<number | null>(null)
const planRecurrence = ref<Zeus.ExpensePlanRecurrence>(Zeus.ExpensePlanRecurrence.NONE)
const planDueDate = ref('')
const planPayTo = ref('')
const planSaving = ref(false)
const addPlanOpen = ref(false)

function planDueLabel(plan: ExpensePlanView): string {
  return plan.due_date ? new Date(String(plan.due_date)).toLocaleDateString('ru-RU') : '—'
}

/** Подпись повторяемости под сроком; пусто — расход разовый. */
function planRecurrenceLabel(plan: ExpensePlanView): string {
  return RECURRENCE_LABELS[String(plan.recurrence)] ?? ''
}

/** Просроченный расход подсвечивается: срок прошёл, а оплаты нет. */
function isPlanOverdue(plan: ExpensePlanView): boolean {
  if (plan.paid_at || !plan.due_date) return false
  return new Date(String(plan.due_date)) < new Date()
}

async function onAddPlan(): Promise<void> {
  const amount = Number(planAmount.value)
  if (!braname.value || !planTitle.value.trim() || !Number.isFinite(amount) || amount <= 0) return
  if (!planDueDate.value) {
    FailAlert(new Error('Укажите дату оплаты'), 'Укажите дату, к которой расход должен быть оплачен')
    return
  }
  planSaving.value = true
  try {
    await createExpensePlan({
      braname: braname.value,
      title: planTitle.value.trim(),
      amount,
      recurrence: planRecurrence.value,
      due_date: new Date(planDueDate.value).toISOString(),
      pay_to: planPayTo.value.trim() || '—',
    })
    SuccessAlert('Плановый расход добавлен')
    addPlanOpen.value = false
    planTitle.value = ''
    planAmount.value = null
    planRecurrence.value = Zeus.ExpensePlanRecurrence.NONE
    planDueDate.value = ''
    planPayTo.value = ''
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось добавить плановый расход')
  } finally {
    planSaving.value = false
  }
}

// ─── Оплата планового расхода через шасси расходов ───
//
// Кошелёк-источник — пул расходов участка: средства уходят туда из общего
// кошелька в момент подачи записки (контракт делает это одной транзакцией),
// а неизрасходованное возвращается участку автоматически.
const BRANCH_EXPENSE_SOURCE_WALLET = 'w.brn.expns'

const payPlanOpen = ref(false)
const payingPlan = ref<ExpensePlanView | null>(null)

const payPlanDraftKey = computed(
  () => `mp:operator-economy:branch-expense:${braname.value || 'none'}:draft`
)

const payPlanPrefill = computed(() => {
  const plan = payingPlan.value
  if (!plan) return undefined
  return {
    description: plan.title,
    amount: assetAmount(plan.amount).toFixed(2),
    deadline: plan.due_date ? String(plan.due_date).slice(0, 10) : '',
  }
})

function onPayPlan(plan: ExpensePlanView): void {
  payingPlan.value = plan
  payPlanOpen.value = true
}

async function submitBranchExpense(payload: ExpenseCreatePayload): Promise<unknown> {
  const result = await createBranchExpense({
    braname: braname.value,
    expense_hash: payload.expense_hash,
    items: payload.items,
    // Диалог отдаёт подписанный документ нетипизированным (он общий для всех
    // потребителей шасси) — структура задаётся схемой мутации.
    statement: payload.statement as ICreateBranchExpenseInput['statement'],
    plan_id: payingPlan.value?.id,
  })
  await loadAll()
  return result
}

function onBranchExpenseCreated(): void {
  payPlanOpen.value = false
  payingPlan.value = null
  SuccessAlert('Расход подан на решение совета')
  void loadAll()
}

async function onDeletePlan(plan: ExpensePlanView): Promise<void> {
  planSaving.value = true
  try {
    await deleteExpensePlan({ plan_id: plan.id })
    SuccessAlert('Плановый расход удалён')
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось удалить плановый расход')
  } finally {
    planSaving.value = false
  }
}

// ─── Веса участников (председатель КУ) ───

const weightColumns = computed<TableSkeletonColumn[]>(() => [
  { label: 'Участник' },
  { label: 'Вес', class: 'col-num' },
  { label: 'Доля', class: 'col-num' },
  { label: 'На кошельке', class: 'col-num' },
  ...(isBranchTrustee.value ? [{ label: '', class: 'col-action', cell: 'icon' as const }] : []),
])

// Кандидаты в распределение — операторы участка, ещё не имеющие веса.
const weightCandidates = computed(() => {
  const b = branch.value
  if (!b || !economy.value) return []
  const present = new Set(economy.value.weights.map((w) => w.username))
  return [b.trustee, ...b.trusted]
    .filter((p) => !present.has(p.username))
    .map((p) => ({ label: personName(p), value: p.username }))
})

const newWeightUsername = ref<string | null>(null)
const newWeightValue = ref<number>(1)
const weightSaving = ref(false)

async function onAddWeight(): Promise<void> {
  if (!braname.value || !newWeightUsername.value) return
  weightSaving.value = true
  try {
    await setTrusteeWeight({
      braname: braname.value,
      username: newWeightUsername.value,
      weight: Math.max(1, Math.round(Number(newWeightValue.value) || 1)),
    })
    SuccessAlert('Вес участника назначен')
    newWeightUsername.value = null
    newWeightValue.value = 1
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось назначить вес')
  } finally {
    weightSaving.value = false
  }
}

const editWeights = ref<Record<string, number>>({})

function onWeightInput(username: string, event: Event): void {
  editWeights.value[username] = Number((event.target as HTMLInputElement).value)
}

async function onUpdateWeight(username: string): Promise<void> {
  const weight = Math.round(Number(editWeights.value[username]))
  if (!braname.value || !Number.isFinite(weight) || weight <= 0) return
  weightSaving.value = true
  try {
    await setTrusteeWeight({ braname: braname.value, username, weight })
    SuccessAlert('Вес обновлён')
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось обновить вес')
  } finally {
    weightSaving.value = false
  }
}

async function onDeleteWeight(username: string): Promise<void> {
  if (!braname.value) return
  weightSaving.value = true
  try {
    await deleteTrusteeWeight({ braname: braname.value, username })
    SuccessAlert('Участник исключён из распределения')
    await loadAll()
  } catch (e) {
    FailAlert(e, 'Не удалось исключить участника')
  } finally {
    weightSaving.value = false
  }
}

// ─── «Получить»: сумма делится между Столом заказов и материальной ───
// ─── помощью (заявление → совет → кассир) ────────────────────────────
//
// Заявление к подписи готовится и подписывается под капотом, читать его перед
// подписью незачем: текст типовой, суммы и реквизиты председатель только что
// ввёл сам, а подписанный документ остаётся в реестре — там его и смотрят.
// Остальные документы кооператива подписываются так же.

const getFundsOpen = ref(false)
const convertPart = ref<number | null>(null)
const aidPart = ref<number | null>(null)
const aidPaymentMethodId = ref<string | null>(null)
const getFundsSubmitting = ref(false)

const getFundsTotal = computed(
  () => (Number(convertPart.value) || 0) + (Number(aidPart.value) || 0)
)
const getFundsOverBalance = computed(
  () => getFundsTotal.value > assetAmount(personalBalance.value)
)

function openGetFundsDialog(): void {
  convertPart.value = null
  aidPart.value = null
  aidPaymentMethodId.value = null
  getFundsOpen.value = true
}

/**
 * Получение целиком одним действием: если в сумме есть материальная помощь —
 * заявление генерируется, подписывается и подаётся здесь же, вместе с
 * переводом в Стол заказов. Разносить операции по шагам нельзя: одна уже
 * совершена, вторая ещё нет, а окно можно закрыть между ними.
 */
async function onGetFunds(): Promise<void> {
  const convert = Number(convertPart.value) || 0
  const aid = Number(aidPart.value) || 0
  if (convert <= 0 && aid <= 0) return
  if (getFundsOverBalance.value) return
  if (aid > 0 && !aidPaymentMethodId.value) {
    FailAlert(new Error('Выберите реквизиты'), 'Для материальной помощи укажите реквизиты получения')
    return
  }

  getFundsSubmitting.value = true
  let aidDone = false
  try {
    if (aid > 0 && braname.value && aidPaymentMethodId.value) {
      const doc = await getAidStatementSignablePayload({ braname: braname.value, amount: aid })
      const signed = await new DigitalDocument(doc).sign(session.username)
      const aidHash = (doc.meta as { aid_hash?: string })?.aid_hash
      if (!aidHash) throw new Error('В заявлении нет идентификатора заявки')
      await createAid({
        braname: braname.value,
        amount: aid,
        aid_hash: aidHash,
        statement: signed,
        payment_method_id: aidPaymentMethodId.value,
      })
      aidDone = true
    }
    if (convert > 0) {
      await convertBranchFunds({ amount: convert })
    }
    SuccessAlert(
      aid > 0 && convert > 0
        ? 'Заявление подано на рассмотрение совета, остальное переведено в кошелёк Стола заказов'
        : aid > 0
          ? 'Заявление подано на рассмотрение совета — выплата после его решения'
          : 'Средства переведены в кошелёк Стола заказов',
    )
    getFundsOpen.value = false
    await loadAll()
  } catch (e) {
    // Заявление уже подано, а перевод не прошёл — говорим об этом прямо, иначе
    // председатель повторит всё сразу и подаст второе заявление.
    FailAlert(
      e,
      aidDone
        ? 'Заявление подано, но перевод в Стол заказов не прошёл — повторите его отдельно'
        : 'Не удалось выполнить получение средств',
    )
    if (aidDone) {
      getFundsOpen.value = false
      await loadAll()
    }
  } finally {
    getFundsSubmitting.value = false
  }
}

</script>

<template lang="pug">
q-page.economy
  OperatorBranchBar

  EmptyState(
    v-if='store.loaded && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Экономика участка доступна председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='savings', size='48px')

  template(v-else)
    PageHint(storage-key='mp:operator-economy:banner-dismissed')
      | С каждого исполненного заказа участок получает членский взнос по единой
      | ставке кооператива — он целиком зачисляется в общий кошелёк участка.
      | Сначала из него покрываются плановые расходы (срочные и ближайшие
      | 30 дней образуют неснижаемый резерв), и только остаток председатель
      | распределяет между участниками по весам — когда и сколько решит сам.
      | Распределённым вы распоряжаетесь двояко: заказать имущество через Стол
      | заказов можно сразу, а материальная помощь выплачивается по вашему
      | заявлению и решению совета (налог с дохода оплачиваете самостоятельно).

    PageTabs(:tabs='tabs', :active-key='activeKey', @select='onSelectTab')
      //- Главное действие таба — в правый верхний угол строки вкладок
      //- (канон PageTabs #actions), а не кнопкой посреди контента.
      template(v-if='activeKey === "expenses" && store.isOperator', #actions)
        BaseButton(variant='primary', size='sm', @click='addPlanOpen = true')
          template(#icon-left)
            q-icon(name='add', size='16px')
          | Добавить расход
      template(v-else-if='activeKey === "distribution" && isBranchTrustee', #actions)
        BaseButton(
          variant='primary',
          size='sm',
          :disabled='availableToDistribute <= 0 || !economy || !economy.weights.length',
          @click='distributeOpen = true'
        )
          template(#icon-left)
            q-icon(name='call_split', size='16px')
          | Распределить
      template(v-else-if='activeKey === "personal"', #actions)
        BaseButton(variant='primary', size='sm', @click='openGetFundsDialog')
          template(#icon-left)
            q-icon(name='payments', size='16px')
          | Получить

    //- Кошелёк участка — только то, что реально пришло в общий пул участка
    //- (членские взносы с исполненных заказов). Персональные средства — не
    //- сюда, это уже распределённое (см. таб «Мои средства»).
    template(v-if='activeKey === "wallet"')
      .economy__cards
        WalletCard(
          program='wallet',
          icon='storefront',
          title='Общий кошелёк участка',
          subtitle='Расходы, закупка впрок и распределения',
          :balance='economy ? assetAmount(economy.common_balance).toFixed(2) : "0.00"',
          :symbol='economy ? assetSymbol(economy.common_balance) : ""',
          :loading='loading && !economy'
        )

      .economy__section
        .economy__section-title Движения по кошельку

        TableSkeleton(v-if='loading && !walletHistory.length', :columns='historyColumns')

        .table-wrap(v-if='walletHistory.length')
          .table-scroll
            table.table
              thead
                tr
                  th Дата
                  th Операция
                  th.col-num Сумма
                  th Назначение
              tbody
                tr(v-for='op in walletHistory', :key='op.global_sequence')
                  td.t-mono {{ formatDateToLocalTimezone(op.created_at, 'DD.MM.YYYY HH:mm') }}
                  td {{ operationLabel({ operationCode: op.operation_code, action: 'apply' }) }}
                  td.col-num.t-mono {{ formatProcessAmount(op.quantity) }}
                  td.economy__memo
                    span {{ op.memo || '—' }}
                    BaseButton(
                      v-if='op.order_id',
                      variant='ghost',
                      size='sm',
                      @click='goToOrder(op.order_id)'
                    )
                      template(#icon-left)
                        q-icon(name='open_in_new', size='14px')
                      | Заказ

        .banner.banner--info(v-else-if='!loading')
          q-icon.banner__icon(name='info', size='18px')
          .banner__body Движений по общему кошельку пока не было.

    //- Плановые расходы участка
    template(v-if='activeKey === "expenses"')
      .economy__cards
        WalletCard(
          program='wallet',
          icon='lock_clock',
          title='Резерв на 30 дней',
          subtitle='Неснижаемый остаток под срочные и ближайшие расходы',
          :balance='economy ? assetAmount(economy.reserve_amount).toFixed(2) : "0.00"',
          :symbol='economy ? assetSymbol(economy.reserve_amount) : ""',
          :loading='loading && !economy'
        )
        WalletCard(
          program='wallet',
          icon='call_split',
          title='Доступно к распределению',
          subtitle='Остаток сверх резерва — из него председатель распределяет',
          :balance='economy ? assetAmount(economy.available_to_distribute).toFixed(2) : "0.00"',
          :symbol='economy ? assetSymbol(economy.available_to_distribute) : ""',
          :loading='loading && !economy'
        )

      .economy__section
        TableSkeleton(v-if='loading && !economy', :columns='planColumns')

        .table-wrap(v-if='plans.length')
          .table-scroll
            table.table
              thead
                tr
                  th Назначение
                  th.col-num Сумма
                  th Срок
                  th Реквизиты
                  th.col-action(v-if='store.isOperator')
              tbody
                tr(v-for='plan in plans', :key='plan.id')
                  td.economy__name {{ plan.title }}
                  td.col-num.t-mono {{ formatAsset2Digits(plan.amount) }}
                  td
                    .economy__due(:class='{ "economy__due--overdue": isPlanOverdue(plan) }') {{ planDueLabel(plan) }}
                    .economy__due-note(v-if='planRecurrenceLabel(plan)')
                      q-icon(name='autorenew', size='14px')
                      | {{ planRecurrenceLabel(plan) }}
                  td.economy__payto {{ plan.pay_to }}
                  td.col-action(v-if='store.isOperator')
                    .economy__row-actions
                      BaseBadge(v-if='plan.paid_at', variant='pos') Оплачен
                      BaseBadge(v-else-if='plan.proposal_hash', variant='info') На рассмотрении совета
                      //- Отправка расхода на решение совета выделяет средства
                      //- участка — это полномочие председателя участка.
                      BaseButton(
                        v-else-if='isBranchTrustee',
                        variant='primary',
                        size='sm',
                        :disabled='planSaving',
                        @click='onPayPlan(plan)'
                      ) Оплатить
                      BaseButton(variant='ghost', size='sm', icon-only, aria-label='Действия')
                        template(#icon-left)
                          q-icon(name='more_vert', size='18px')
                          q-menu(anchor='bottom right', self='top right')
                            q-list(dense, style='min-width: 200px')
                              q-item(clickable, v-close-popup, @click='onDeletePlan(plan)')
                                q-item-section(avatar)
                                  q-icon(name='delete', size='18px')
                                q-item-section Удалить расход

        EmptyState(
          v-else-if='economy && !plans.length',
          title='Плановых расходов нет',
          body='Весь общий кошелёк доступен распределению. Добавьте предстоящую трату участка, чтобы система удерживала под неё резерв.'
        )
          template(#icon)
            q-icon(name='receipt_long', size='48px')

    //- Распределение членских взносов — участники (веса) + ручная команда «Распределить»
    template(v-if='activeKey === "distribution"')
      .economy__section
        TableSkeleton(v-if='loading && !economy', :columns='weightColumns')

        .table-wrap(v-if='economy && economy.weights.length')
          .table-scroll
            table.table
              thead
                tr
                  th Участник
                  th.col-num Вес
                  th.col-num Доля
                  th.col-num На кошельке
                  th.col-action(v-if='isBranchTrustee')
              tbody
                tr(v-for='w in economy.weights', :key='w.username')
                  td.economy__name {{ nameByUsername[w.username] || w.username }}
                  td.col-num
                    template(v-if='isBranchTrustee')
                      input.economy__weight-input(
                        type='number',
                        min='1',
                        :value='editWeights[w.username] ?? w.weight',
                        @input='onWeightInput(w.username, $event)',
                        @change='onUpdateWeight(w.username)'
                      )
                    template(v-else) {{ w.weight }}
                  td.col-num {{ w.share_percent.toFixed(1) }} %
                  td.col-num.t-mono {{ formatAsset2Digits(w.personal_balance) }}
                  td.col-action(v-if='isBranchTrustee')
                    BaseButton(
                      variant='ghost',
                      icon-only,
                      size='sm',
                      aria-label='Исключить из распределения',
                      :disabled='weightSaving',
                      @click='onDeleteWeight(w.username)'
                    )
                      template(#icon-left)
                        q-icon(name='person_remove', size='18px')

        .banner.banner--info(v-else-if='economy && !economy.weights.length')
          q-icon.banner__icon(name='info', size='18px')
          .banner__body
            | Веса распределения не настроены. Назначьте веса участникам, чтобы
            | председатель мог распределять средства общего кошелька персонально.

        .economy__add(v-if='isBranchTrustee && weightCandidates.length')
          BaseSelect.economy__add-select(
            v-model='newWeightUsername',
            label='Участник распределения',
            :options='weightCandidates'
          )
          AmountInput.economy__add-weight(
            v-model='newWeightValue',
            label='Вес',
            :precision='0',
            :min='1'
          )
          BaseButton(
            variant='primary',
            :loading='weightSaving',
            :disabled='!newWeightUsername',
            @click='onAddWeight'
          ) Добавить в распределение

    //- Мои средства — свободная доля (получена после распределения) и лента
    //- выплат: каждое «Получить» превращается в карточку своего статуса.
    template(v-if='activeKey === "personal"')
      .economy__cards
        WalletCard(
          program='wallet',
          title='Мои свободные средства',
          subtitle='Можно получить в Стол заказов или материальной помощью',
          :balance='assetAmount(personalBalance).toFixed(2)',
          :symbol='assetSymbol(personalBalance)',
          :loading='loading && !personalBalance'
        )

      //- Заявления на материальную помощь в процессе: пока совет не принял
      //- решение — показываем стадию рассмотрения, после одобрения — реальный
      //- статус выплаты у кассира.
      .economy__section(v-if='aids.length')
        .economy__section-title В процессе
        .economy__payout-cards
          BaseCard(v-for='a in aids', :key='a.hash')
            template(#head)
              div
                .t-mono.economy__payout-amount {{ formatAsset2Digits(a.amount) }}
                .t-muted Материальная помощь
              BaseBadge(:variant='aidStageVariant(a)') {{ aidStageLabel(a) }}
            .t-muted(v-if='a.stage === "ON_COUNCIL"')
              | Заявление на рассмотрении совета — выплата возможна только по его решению.
            .t-muted(v-if='a.payment_destination') На реквизиты: {{ a.payment_destination }}

      //- История завершённых получений (перевод в Стол заказов + выплаченная
      //- материальная помощь) — движения персонального кошелька ledger2.
      //- Список однородный, поэтому таблица, как у общего кошелька участка.
      .economy__section(v-if='personalWalletHistory.length')
        .economy__section-title История
        .table-wrap
          .table-scroll
            table.table
              thead
                tr
                  th Дата
                  th Операция
                  th.col-num Сумма
                  th.col-action Статус
              tbody
                tr(v-for='op in personalWalletHistory', :key='op.global_sequence')
                  td.t-mono {{ formatDateToLocalTimezone(op.created_at, 'DD.MM.YYYY HH:mm') }}
                  td {{ operationLabel({ operationCode: op.operation_code, action: 'apply' }) }}
                  td.col-num.t-mono {{ formatProcessAmount(op.quantity) }}
                  td.col-action
                    BaseBadge(variant='pos') Выполнено

      EmptyState(
        v-if='!loading && !aids.length && !personalWalletHistory.length',
        title='Получений ещё не было',
        body='Нажмите «Получить», чтобы перевести свободные средства в Стол заказов или запросить материальную помощь.'
      )
        template(#icon)
          q-icon(name='payments', size='48px')

  //- Оплата планового расхода — общий диалог шасси расходов: он собирает
  //- позиции, формирует служебную записку и берёт подпись, а подача на цепь
  //- (выделение средств участка + постановка на совет) — в submit.
  ExpenseCreateDialog(
    v-model='payPlanOpen',
    title='Оплата расхода участка',
    :source-wallet='BRANCH_EXPENSE_SOURCE_WALLET',
    :draft-key='payPlanDraftKey',
    :prefill='payPlanPrefill',
    :submit='submitBranchExpense',
    @created='onBranchExpenseCreated'
  )

  //- Диалог добавления планового расхода
  BaseDialog(v-model='addPlanOpen', title='Новый плановый расход', size='md')
    //- Поля идут плотно: каждое из них уже резервирует строку под подсказку,
    //- и дополнительный зазор растягивал короткую форму на весь экран.
    .economy__dialog-body.economy__plan-form
      BaseInput(v-model='planTitle', label='Назначение расхода')
      AmountInput(v-model='planAmount', label='Сумма', :precision='2', :min='0')
      BaseInput(v-model='planDueDate', label='Оплатить к дате', type='date')
      BaseSelect(v-model='planRecurrence', label='Повторяемость', :options='planRecurrenceOptions')
      BaseInput(v-model='planPayTo', label='Реквизиты оплаты')
    template(#footer)
      BaseButton(variant='ghost', :disabled='planSaving', @click='addPlanOpen = false') Отмена
      BaseButton(
        variant='primary',
        :loading='planSaving',
        :disabled='!planTitle || !planAmount || !planDueDate',
        @click='onAddPlan'
      ) Добавить расход

  //- Диалог распределения
  BaseDialog(v-model='distributeOpen', title='Распределить из общего кошелька', size='sm')
    .economy__dialog-body
      p
        | Сумма разойдётся между участниками распределения пропорционально их
        | весам. Распределять можно частично и несколько раз; резерв плановых
        | расходов на 30 дней останется в общем кошельке.
      AmountInput(
        v-model='distributeAmount',
        label='Сумма распределения',
        :symbol='economy ? assetSymbol(economy.common_balance) : ""',
        :precision='2',
        :min='0',
        show-max,
        show-balance,
        :balance='availableToDistribute'
      )
    template(#footer)
      BaseButton(variant='ghost', :disabled='distributing', @click='distributeOpen = false') Отмена
      BaseButton(variant='primary', :loading='distributing', :disabled='!distributeAmount', @click='onDistribute') Распределить

  //- Диалог «Получить» — сумма делится между Столом заказов (мгновенно) и
  //- материальной помощью (заявление → подпись → выплата кассиром).
  //- На шаге заявления разворачиваем диалог на весь экран — канон просмотра
  //- и подписания документов (в 640px лист документа не читается).
  BaseDialog(
    v-model='getFundsOpen',
    title='Получить средства',
    size='md'
  )
    .economy__dialog-body
      p
        | Разделите сумму между переводом в Стол заказов и материальной
        | помощью — её вы получаете по заявлению, которое рассматривает
        | совет; после одобрения кассир переводит деньги на выбранные
        | реквизиты. Налог с дохода вы оплачиваете самостоятельно.
      AmountInput(
        v-model='convertPart',
        label='В Стол заказов',
        :symbol='assetSymbol(personalBalance)',
        :precision='2',
        :min='0'
      )
      AmountInput(
        v-model='aidPart',
        label='Материальной помощью',
        :symbol='assetSymbol(personalBalance)',
        :precision='2',
        :min='0'
      )
      PaymentMethodSelect(
        v-if='Number(aidPart) > 0',
        v-model='aidPaymentMethodId',
        :username='session.username',
        required
      )
      p.economy__get-funds-total(:class='{ "economy__get-funds-total--over": getFundsOverBalance }')
        | Итого: {{ getFundsTotal.toFixed(2) }} из {{ assetAmount(personalBalance).toFixed(2) }} {{ assetSymbol(personalBalance) }} доступно
      //- Заявление о материальной помощи подписывается под капотом: читать
      //- типовой текст перед подписью незачем, подписанный документ виден в
      //- заявке.
      p.economy__get-funds-note(v-if='Number(aidPart) > 0')
        | Заявление о материальной помощи будет подписано вашей электронной
        | подписью автоматически.
    template(#footer)
      BaseButton(
        variant='ghost',
        :disabled='getFundsSubmitting',
        @click='getFundsOpen = false'
      ) Отмена
      BaseButton(
        variant='primary',
        :loading='getFundsSubmitting',
        :disabled='getFundsTotal <= 0 || getFundsOverBalance',
        @click='onGetFunds'
      ) Получить
</template>

<style scoped lang="scss">
.economy {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--p-4, 16px);
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__section-title {
    font-weight: 600;
    font-size: var(--p-fs-md, 1rem);
  }

  &__payout-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--p-3, 12px);
  }

  &__payout-amount {
    font-size: var(--p-fs-md, 1rem);
    font-weight: 600;
  }

  &__get-funds-note {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
  }

  &__get-funds-total {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 12px);

    &--over {
      color: var(--p-neg);
    }
  }

  &__due--overdue {
    color: var(--p-neg);
    font-weight: 600;
  }

  &__due-note {
    display: flex;
    align-items: center;
    gap: var(--p-1);
    margin-top: 2px;
    font-size: var(--p-fs-meta);
    color: var(--p-ink-3);
  }

  &__row-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--p-2);
  }

  &__payto {
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // Назначение движения — полный текст читаем (не обрезаем), плюс кнопка
  // перехода в конкретный заказ, если движение с ним связано (жалоба
  // 2026-08-03: эллипсис прятал номер заказа из memo).
  &__memo {
    max-width: 360px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);
  }

  &__name {
    font-weight: 600;
  }

  &__weight-input {
    width: 80px;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    padding: var(--p-1, 4px) var(--p-2, 8px);
    background: var(--p-surface);
    color: var(--p-ink);
  }

  &__add {
    display: flex;
    align-items: flex-start;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__add-select {
    min-width: 260px;
  }

  &__add-weight {
    max-width: 140px;
  }

  &__dialog-body {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
    color: var(--p-ink-2);
  }

  // Короткая форма из одних полей: резерва строки под подсказку достаточно,
  // собственный зазор между полями не нужен.
  &__plan-form {
    gap: 0;
  }

}

.col-num {
  width: 130px;
}
.col-action {
  width: 64px;
  text-align: right;
}

@media (max-width: 768px) {
  .economy {
    padding: var(--p-4, 16px);
  }
}
</style>
