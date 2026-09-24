<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { uiLocale, t as i18nT } from 'src/shared/i18n';
import { useFirstLoad } from 'src/shared/lib/composables'
import { useRoute } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useSessionStore } from 'src/entities/Session'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { DigitalDocument } from 'src/shared/lib/document'
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseInput, BaseSelect, BaseTable, EmptyState } from 'src/shared/ui/base'
import type { BaseBadgeVariant, BaseTableColumn } from 'src/shared/ui/base'
import { AmountInput, PageHint, WalletCard } from 'src/shared/ui/domain'
import { ExpenseCreateDialog, type ExpenseCreatePayload } from 'src/shared/ui/domain/ExpenseCreateDialog'
import { PaymentMethodSelect } from 'src/shared/ui/domain/PaymentMethodSelect'
import { PageTabs, type PageTab } from 'src/shared/ui/layout'
import { TurnoverTop } from 'src/widgets/Marketplace/TurnoverTop'
import { OrderRegistryOverlay } from 'src/widgets/Marketplace/OrderRegistryOverlay'
import { useQueryOverlay } from 'src/shared/lib/navigation'
import { listInventory, type MarketplaceInventoryItemView } from 'src/entities/MarketplaceInventory'
import {
  fetchOrdersForTurnover,
  type MarketplaceOrderListView,
} from 'src/entities/MarketplaceOrder'
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { operationLabel, formatProcessAmount } from 'src/shared/lib/ledger2'
import { NDFL_RATE_PERCENT, marketLiveTables, ndflNet, ndflTax } from 'src/shared/lib/marketplace'
import { Ledger2Contract } from 'cooptypes'
import { liveTable, useLiveReload } from 'src/shared/lib/realtime'
import { paymentStatusLabel, paymentStatusVariant } from 'src/shared/lib/payment'
import {
  type ExpensePlanView,
  type MarketplaceAidView,
  type MarketplaceBranchEconomyView,
  type MarketplaceBranchWalletHistoryView,
  type MarketplacePersonalWalletHistoryView,
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
 *  1. «Мои средства» — персональный кошелёк распределённых средств
 *     текущего оператора: материальная помощь (заявление → решение совета →
 *     выплата кассиром). Перевода в Стол заказов нет — в паевой модели заказы
 *     оплачиваются паевым взносом из Кошелька. НДФЛ кооператив удерживает сам: заявление подаётся на
 *     сумму до налога, на счёт приходит остаток.
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
const orderOverlay = useQueryOverlay('order')
const session = useSessionStore()
const store = useOperatorBranchStore()

const coopname = computed(() => String(route.params.coopname ?? ''))
const braname = computed(() => store.activeBraname ?? '')
const branch = computed(() => store.activeBranch?.branch ?? null)
const isBranchTrustee = computed(
  () => !!branch.value?.trustee && branch.value.trustee.username === session.username
)

const loading = ref(true)
/** Скелетон — только на первой загрузке; дочитка обновляет молча. */
const firstLoad = useFirstLoad(loading)
const economy = ref<MarketplaceBranchEconomyView | null>(null)
const plans = ref<ExpensePlanView[]>([])
const personalBalance = ref('')
const aids = ref<MarketplaceAidView[]>([])
const walletHistory = ref<MarketplaceBranchWalletHistoryView['items']>([])
const personalWalletHistory = ref<MarketplacePersonalWalletHistoryView['items']>([])

// ─── Табы страницы (requirement — переверстка без изменения логики) ───

const activeKey = ref<'wallet' | 'turnover' | 'expenses' | 'distribution' | 'personal'>('wallet')

const tabs = computed<PageTab[]>(() => [
  { key: 'wallet', label: i18nT('marketplace.operatorBranchEconomyPage.walletTabLabel') },
  { key: 'turnover', label: i18nT('marketplace.operatorBranchEconomyPage.turnoverTabLabel') },
  { key: 'expenses', label: i18nT('marketplace.operatorBranchEconomyPage.plannedExpensesTabLabel'), count: plans.value.length || undefined },
  { key: 'distribution', label: i18nT('marketplace.operatorBranchEconomyPage.distributionTabLabel'), count: economy.value?.weights.length || undefined },
  { key: 'personal', label: i18nT('marketplace.operatorBranchEconomyPage.myFundsTabLabel') },
])

// ─── Оборот участка ───
// Тот же раздел, что на «Экономике» кооператива, только данные своего участка:
// сколько имущества принято на склад и на какую сумму, сколько выдано
// пайщикам и сколько участок получил целевым членским взносом.
const turnoverPeriodDays = ref<number>(30)
const turnoverInventory = ref<MarketplaceInventoryItemView[]>([])
const turnoverOrders = ref<MarketplaceOrderListView[]>([])
const turnoverLoading = ref(true)

/** Сколько исполненных заказов забираем под свод: хвост старше периода не нужен. */
const TURNOVER_ORDERS_LIMIT = 500

/** `silent` — перечитывание по ленте: свод обновляется на месте, без скелетона. */
async function loadTurnover(silent = false): Promise<void> {
  if (!braname.value) return
  if (!silent) turnoverLoading.value = true
  try {
    const [inventoryRows, orderRows] = await Promise.all([
      listInventory({ braname: braname.value }),
      fetchOrdersForTurnover({ braname: braname.value, limit: TURNOVER_ORDERS_LIMIT }),
    ])
    turnoverInventory.value = inventoryRows
    turnoverOrders.value = orderRows
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorBranchEconomyPage.loadTurnoverFailedMessage'))
  } finally {
    turnoverLoading.value = false
  }
}

function onSelectTab(tab: PageTab): void {
  activeKey.value = tab.key as typeof activeKey.value
}

// Заказ из движения кошелька раскрывается оверлеем прямо здесь: экономика
// остаётся на месте со своей вкладкой и прокруткой, а на полную страницу
// уводит кнопка «Открыть заказ» внутри оверлея — уход по нажатию на ссылку
// сбрасывал оператора на другой раздел, и было непонятно, где он оказался.
function goToOrder(orderId: string): void {
  orderOverlay.open(orderId)
}

/**
 * Заказ стоит не за каждым движением: взносы и распределения приходят и без
 * него. Поэтому нажатие работает построчно — там, где заказ есть, а не кнопкой
 * в ячейке назначения: кнопка отнимала место у текста и заставляла целиться в
 * неё вместо строки.
 */
function hasOrder(row: WalletHistoryRow): boolean {
  return Boolean(row.order_id)
}

function openHistoryOrder(row: WalletHistoryRow): void {
  if (row.order_id) goToOrder(row.order_id)
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
  if (aid.stage === 'ON_COUNCIL') return i18nT('marketplace.operatorBranchEconomyPage.statusUnderCouncilReview')
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
  if (!b.trustee) return {}
  const map: Record<string, string> = { [b.trustee.username]: personName(b.trustee) }
  for (const t of b.trusted ?? []) map[t.username] = personName(t)
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
    FailAlert(e, i18nT('marketplace.operatorBranchEconomyPage.loadEconomyFailedMessage'))
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await store.ensureLoaded(coopname.value)
  void loadAll()
  void loadTurnover()
})

watch(braname, () => {
  void loadAll()
  void loadTurnover()
})

// Экономика участка живёт по ленте: веса и помощь участка, сбор с оборота,
// кошельки (общий — совету, личный — владельцу), платежи по матпомощи и
// плановые расходы. Оборот — по приёмкам склада и исполненным заказам.
useLiveReload(
  [
    ...marketLiveTables('economy'),
    liveTable(Ledger2Contract, Ledger2Contract.Tables.Wallets),
    liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets),
    { code: 'core', table: 'payments' },
    { code: 'expenses', table: 'expense_plans' },
  ],
  loadAll,
)
useLiveReload(marketLiveTables('order', 'warehouse'), () => loadTurnover(true))

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
    SuccessAlert(i18nT('marketplace.operatorBranchEconomyPage.distributedMessage'))
    distributeOpen.value = false
    distributeAmount.value = null
    await loadAll()
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorBranchEconomyPage.distributeFailedMessage'))
  } finally {
    distributing.value = false
  }
}

// ─── Движения по общему кошельку (ledger2 через inter-порт) ───

type WalletHistoryRow = MarketplaceBranchWalletHistoryView['items'][number]

const historyColumns: BaseTableColumn<WalletHistoryRow>[] = [
  { key: 'date', label: i18nT('marketplace.operatorBranchEconomyPage.columnDate'), width: '170px', nowrap: true },
  { key: 'operation', label: i18nT('marketplace.operatorBranchEconomyPage.columnOperation'), width: '260px' },
  { key: 'amount', label: i18nT('marketplace.operatorBranchEconomyPage.amountLabel'), width: '150px', numeric: true },
  { key: 'memo', label: i18nT('marketplace.operatorBranchEconomyPage.columnPurpose'), width: '320px' },
]

// ─── Плановые расходы участка (оффчейн-реестр; резерв 30 дней) ───

const planColumns = computed<BaseTableColumn<ExpensePlanView>[]>(() => [
  { key: 'title', label: i18nT('marketplace.operatorBranchEconomyPage.columnPurpose'), width: '260px', sortable: true, field: 'title' },
  { key: 'amount', label: i18nT('marketplace.operatorBranchEconomyPage.amountLabel'), width: '150px', numeric: true },
  { key: 'due', label: i18nT('marketplace.operatorBranchEconomyPage.columnTerm'), width: '190px' },
  { key: 'payto', label: i18nT('marketplace.operatorBranchEconomyPage.columnRequisites'), width: '240px', field: 'pay_to' },
  ...(store.isOperator
    ? [{ key: 'actions', label: '', width: '220px' } as BaseTableColumn<ExpensePlanView>]
    : []),
])

// Приоритетов у расхода нет: всё, что заведено в реестр, подлежит оплате.
// Единственная ось — регулярность: разовая трата или повторяющаяся.
const planRecurrenceOptions = [
  { label: i18nT('marketplace.operatorBranchEconomyPage.recurrenceOnce'), value: Zeus.ExpensePlanRecurrence.NONE },
  { label: i18nT('marketplace.operatorBranchEconomyPage.recurrenceMonthly'), value: Zeus.ExpensePlanRecurrence.MONTHLY },
  { label: i18nT('marketplace.operatorBranchEconomyPage.recurrenceQuarterly'), value: Zeus.ExpensePlanRecurrence.QUARTERLY },
  { label: i18nT('marketplace.operatorBranchEconomyPage.recurrenceYearly'), value: Zeus.ExpensePlanRecurrence.YEARLY },
]

const RECURRENCE_LABELS: Record<string, string> = {
  [Zeus.ExpensePlanRecurrence.MONTHLY]: i18nT('marketplace.operatorBranchEconomyPage.recurrenceMonthlyShort'),
  [Zeus.ExpensePlanRecurrence.QUARTERLY]: i18nT('marketplace.operatorBranchEconomyPage.recurrenceQuarterlyShort'),
  [Zeus.ExpensePlanRecurrence.YEARLY]: i18nT('marketplace.operatorBranchEconomyPage.recurrenceYearlyShort'),
}

const planTitle = ref('')
const planAmount = ref<number | null>(null)
const planRecurrence = ref<Zeus.ExpensePlanRecurrence>(Zeus.ExpensePlanRecurrence.NONE)
const planDueDate = ref('')
const planPayTo = ref('')
const planSaving = ref(false)
const addPlanOpen = ref(false)

function planDueLabel(plan: ExpensePlanView): string {
  return plan.due_date ? new Date(String(plan.due_date)).toLocaleDateString(uiLocale()) : '—'
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
    FailAlert(new Error(i18nT('marketplace.error.paymentDateRequired')), i18nT('marketplace.operatorBranchEconomyPage.paymentDateRequiredHint'))
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
    SuccessAlert(i18nT('marketplace.operatorBranchEconomyPage.expenseAddedMessage'))
    addPlanOpen.value = false
    planTitle.value = ''
    planAmount.value = null
    planRecurrence.value = Zeus.ExpensePlanRecurrence.NONE
    planDueDate.value = ''
    planPayTo.value = ''
    await loadAll()
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorBranchEconomyPage.addExpenseFailedMessage'))
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
  SuccessAlert(i18nT('marketplace.operatorBranchEconomyPage.expenseSentToCouncilMessage'))
  void loadAll()
}

async function onDeletePlan(plan: ExpensePlanView): Promise<void> {
  planSaving.value = true
  try {
    await deleteExpensePlan({ plan_id: plan.id })
    SuccessAlert(i18nT('marketplace.operatorBranchEconomyPage.expenseDeletedMessage'))
    await loadAll()
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorBranchEconomyPage.deleteExpenseFailedMessage'))
  } finally {
    planSaving.value = false
  }
}

// ─── Веса участников (председатель КУ) ───

type BranchWeightRow = NonNullable<typeof economy.value>['weights'][number]

const weightColumns = computed<BaseTableColumn<BranchWeightRow>[]>(() => [
  { key: 'member', label: i18nT('marketplace.operatorBranchEconomyPage.columnParticipant'), width: '260px' },
  { key: 'weight', label: i18nT('marketplace.operatorBranchEconomyPage.columnWeight'), width: '130px', numeric: true },
  { key: 'share', label: i18nT('marketplace.operatorBranchEconomyPage.columnShare'), width: '120px', numeric: true },
  { key: 'balance', label: i18nT('marketplace.operatorBranchEconomyPage.columnOnWallet'), width: '160px', numeric: true },
  ...(isBranchTrustee.value
    ? [{ key: 'actions', label: '', width: '110px' } as BaseTableColumn<BranchWeightRow>]
    : []),
])

type PersonalHistoryRow = MarketplacePersonalWalletHistoryView['items'][number]

const personalHistoryColumns: BaseTableColumn<PersonalHistoryRow>[] = [
  { key: 'date', label: i18nT('marketplace.operatorBranchEconomyPage.columnDate'), width: '170px', nowrap: true },
  { key: 'operation', label: i18nT('marketplace.operatorBranchEconomyPage.columnOperation'), width: '280px' },
  { key: 'amount', label: i18nT('marketplace.operatorBranchEconomyPage.amountLabel'), width: '150px', numeric: true },
  { key: 'status', label: i18nT('marketplace.operatorBranchEconomyPage.columnStatus'), width: '140px' },
]

// Кандидаты в распределение — операторы участка, ещё не имеющие веса.
const weightCandidates = computed(() => {
  const b = branch.value
  if (!b || !economy.value) return []
  const present = new Set(economy.value.weights.map((w) => w.username))
  if (!b.trustee) return []
  return [b.trustee, ...(b.trusted ?? [])]
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
    SuccessAlert(i18nT('marketplace.operatorBranchEconomyPage.weightAssignedMessage'))
    newWeightUsername.value = null
    newWeightValue.value = 1
    await loadAll()
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorBranchEconomyPage.assignWeightFailedMessage'))
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
    SuccessAlert(i18nT('marketplace.operatorBranchEconomyPage.weightUpdatedMessage'))
    await loadAll()
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorBranchEconomyPage.updateWeightFailedMessage'))
  } finally {
    weightSaving.value = false
  }
}

async function onDeleteWeight(username: string): Promise<void> {
  if (!braname.value) return
  weightSaving.value = true
  try {
    await deleteTrusteeWeight({ braname: braname.value, username })
    SuccessAlert(i18nT('marketplace.operatorBranchEconomyPage.participantExcludedMessage'))
    await loadAll()
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorBranchEconomyPage.excludeParticipantFailedMessage'))
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
const aidPart = ref<number | null>(null)
const aidPaymentMethodId = ref<string | null>(null)
const getFundsSubmitting = ref(false)

const getFundsTotal = computed(() => Number(aidPart.value) || 0)
const getFundsOverBalance = computed(
  () => getFundsTotal.value > assetAmount(personalBalance.value)
)

// Кооператив удерживает НДФЛ с материальной помощи: с кошелька спишется вся
// заявленная сумма, на счёт придёт остаток. Расчёт зеркалит контракт.
const aidGross = computed(() => Number(aidPart.value) || 0)
const aidTax = computed(() => ndflTax(aidGross.value))
const aidNet = computed(() => ndflNet(aidGross.value))

function openGetFundsDialog(): void {
  aidPart.value = null
  aidPaymentMethodId.value = null
  getFundsOpen.value = true
}

/**
 * Получение средств = материальная помощь: заявление генерируется,
 * подписывается и подаётся здесь же; совет решает, кассир выплачивает.
 */
async function onGetFunds(): Promise<void> {
  const aid = Number(aidPart.value) || 0
  if (aid <= 0) return
  if (getFundsOverBalance.value) return
  if (!aidPaymentMethodId.value) {
    FailAlert(new Error(i18nT('marketplace.error.payoutDetailsRequired')), i18nT('marketplace.operatorBranchEconomyPage.payoutDetailsRequiredHint'))
    return
  }
  if (!braname.value) return

  getFundsSubmitting.value = true
  try {
    const doc = await getAidStatementSignablePayload({ braname: braname.value, amount: aid })
    const signed = await new DigitalDocument(doc).sign(session.username)
    const aidHash = (doc.meta as { aid_hash?: string })?.aid_hash
    if (!aidHash) throw new Error(i18nT('marketplace.error.aidHashMissing'))
    await createAid({
      braname: braname.value,
      amount: aid,
      aid_hash: aidHash,
      statement: signed,
      payment_method_id: aidPaymentMethodId.value,
    })
    SuccessAlert(i18nT('marketplace.operatorBranchEconomyPage.aidSubmittedMessage'))
    getFundsOpen.value = false
    await loadAll()
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorBranchEconomyPage.submitAidFailedMessage'))
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
    :title='$t("marketplace.operatorBranchEconomyPage.notOperatorTitle")',
    :body='$t("marketplace.operatorBranchEconomyPage.notOperatorBody")'
  )
    template(#icon)
      q-icon(name='savings', size='48px')

  template(v-else)
    PageHint(storage-key='mp:operator-economy:banner-dismissed')
      | {{ $t('marketplace.operatorBranchEconomyPage.bannerHintFee') }}
      | {{ $t('marketplace.operatorBranchEconomyPage.bannerHintWallet') }}
      | {{ $t('marketplace.operatorBranchEconomyPage.bannerHintExpenses') }}
      | {{ $t('marketplace.operatorBranchEconomyPage.bannerHintReserve') }}
      | {{ $t('marketplace.operatorBranchEconomyPage.bannerHintDistribute') }}
      | {{ $t('marketplace.operatorBranchEconomyPage.bannerHintSpend') }}
      | {{ $t('marketplace.operatorBranchEconomyPage.bannerHintAidIntro') }}
      | {{ $t('marketplace.operatorBranchEconomyPage.bannerHintAidCouncil') }}
      | {{ $t('marketplace.operatorBranchEconomyPage.bannerHintAidNet') }}

    PageTabs(:tabs='tabs', :active-key='activeKey', @select='onSelectTab')
      //- Главное действие таба — в правый верхний угол строки вкладок
      //- (канон PageTabs #actions), а не кнопкой посреди контента.
      template(v-if='activeKey === "expenses" && store.isOperator', #actions)
        BaseButton(variant='primary', size='sm', @click='addPlanOpen = true')
          template(#icon-left)
            q-icon(name='add', size='16px')
          | {{ $t('marketplace.operatorBranchEconomyPage.addExpenseAction') }}
      template(v-else-if='activeKey === "distribution" && isBranchTrustee', #actions)
        BaseButton(
          variant='primary',
          size='sm',
          :disabled='availableToDistribute <= 0 || !economy || !economy.weights.length',
          @click='distributeOpen = true'
        )
          template(#icon-left)
            q-icon(name='call_split', size='16px')
          | {{ $t('marketplace.operatorBranchEconomyPage.distributeAction') }}
      template(v-else-if='activeKey === "personal"', #actions)
        BaseButton(variant='primary', size='sm', @click='openGetFundsDialog')
          template(#icon-left)
            q-icon(name='payments', size='16px')
          | {{ $t('marketplace.operatorBranchEconomyPage.receiveAction') }}

    //- Кошелёк участка — только то, что реально пришло в общий пул участка
    //- (членские взносы с исполненных заказов). Персональные средства — не
    //- сюда, это уже распределённое (см. таб «Мои средства»).
    template(v-if='activeKey === "wallet"')
      .economy__cards
        WalletCard(
          program='wallet',
          icon='storefront',
          :title='$t("marketplace.operatorBranchEconomyPage.commonWalletTitle")',
          :subtitle='$t("marketplace.operatorBranchEconomyPage.commonWalletSubtitle")',
          :balance='economy ? assetAmount(economy.common_balance).toFixed(2) : "0.00"',
          :symbol='economy ? assetSymbol(economy.common_balance) : ""',
          :loading='loading && !economy'
        )

      .economy__section
        .economy__section-title {{ $t('marketplace.operatorBranchEconomyPage.walletMovementsTitle') }}

        BaseTable(
          v-if='firstLoad || walletHistory.length',
          :columns='historyColumns',
          :rows='walletHistory',
          row-key='global_sequence',
          :loading='firstLoad',
          min-width='900px',
          :clickable-rows='hasOrder',
          @row-click='openHistoryOrder'
        )
          template(#cell-date='{ row }')
            span.t-mono {{ formatDateToLocalTimezone(row.created_at, 'DD.MM.YYYY HH:mm') }}
          template(#cell-operation='{ row }')
            | {{ operationLabel({ operationCode: row.operation_code, action: 'apply' }) }}
          template(#cell-amount='{ row }')
            span.t-mono {{ formatProcessAmount(row.quantity) }}
          template(#cell-memo='{ row }')
            | {{ row.memo || '—' }}

        .banner.banner--info(v-else)
          q-icon.banner__icon(name='info', size='18px')
          .banner__body {{ $t('marketplace.operatorBranchEconomyPage.walletMovementsEmpty') }}

    //- Плановые расходы участка
    //- Оборот участка: тот же раздел, что на «Экономике» кооператива. Колонка
    //- пункта выдачи не нужна — участок здесь один.
    template(v-if='activeKey === "turnover"')
      TurnoverTop(
        v-model='turnoverPeriodDays',
        :inventory='turnoverInventory',
        :orders='turnoverOrders',
        :loading='turnoverLoading',
        :show-branch='false'
      )

    template(v-if='activeKey === "expenses"')
      .economy__cards
        WalletCard(
          program='wallet',
          icon='lock_clock',
          :title='$t("marketplace.operatorBranchEconomyPage.reserveTitle")',
          :subtitle='$t("marketplace.operatorBranchEconomyPage.reserveSubtitle")',
          :balance='economy ? assetAmount(economy.reserve_amount).toFixed(2) : "0.00"',
          :symbol='economy ? assetSymbol(economy.reserve_amount) : ""',
          :loading='loading && !economy'
        )
        WalletCard(
          program='wallet',
          icon='call_split',
          :title='$t("marketplace.operatorBranchEconomyPage.availableToDistributeTitle")',
          :subtitle='$t("marketplace.operatorBranchEconomyPage.availableToDistributeSubtitle")',
          :balance='economy ? assetAmount(economy.available_to_distribute).toFixed(2) : "0.00"',
          :symbol='economy ? assetSymbol(economy.available_to_distribute) : ""',
          :loading='loading && !economy'
        )

      .economy__section
        BaseTable(
          v-if='firstLoad || plans.length',
          :columns='planColumns',
          :rows='plans',
          row-key='id',
          :loading='firstLoad',
          min-width='960px',
          sort-by='title'
        )
          template(#cell-title='{ row: plan }')
            .economy__name {{ plan.title }}
          template(#cell-amount='{ row: plan }')
            span.t-mono {{ formatAsset2Digits(plan.amount) }}
          template(#cell-due='{ row: plan }')
            .economy__due(:class='{ "economy__due--overdue": isPlanOverdue(plan) }') {{ planDueLabel(plan) }}
            .economy__due-note(v-if='planRecurrenceLabel(plan)')
              q-icon(name='autorenew', size='14px')
              | {{ planRecurrenceLabel(plan) }}
          template(#cell-payto='{ row: plan }')
            .economy__payto {{ plan.pay_to }}
          template(#cell-actions='{ row: plan }')
                    .economy__row-actions
                      BaseBadge(v-if='plan.paid_at', variant='pos') {{ $t('marketplace.operatorBranchEconomyPage.statusPaid') }}
                      BaseBadge(v-else-if='plan.proposal_hash', variant='info') {{ $t('marketplace.operatorBranchEconomyPage.statusUnderCouncilReview') }}
                      //- Отправка расхода на решение совета выделяет средства
                      //- участка — это полномочие председателя участка.
                      BaseButton(
                        v-else-if='isBranchTrustee',
                        variant='primary',
                        size='sm',
                        :disabled='planSaving',
                        @click='onPayPlan(plan)'
                      ) {{ $t('marketplace.operatorBranchEconomyPage.payAction') }}
                      BaseButton(variant='ghost', size='sm', icon-only, :aria-label='$t("marketplace.operatorBranchEconomyPage.actionsAriaLabel")')
                        template(#icon-left)
                          q-icon(name='more_vert', size='18px')
                          q-menu(anchor='bottom right', self='top right')
                            q-list(dense, style='min-width: 200px')
                              q-item(clickable, v-close-popup, @click='onDeletePlan(plan)')
                                q-item-section(avatar)
                                  q-icon(name='delete', size='18px')
                                q-item-section {{ $t('marketplace.operatorBranchEconomyPage.deleteExpenseAction') }}

        EmptyState(
          v-else-if='economy',
          :title='$t("marketplace.operatorBranchEconomyPage.emptyExpensesTitle")',
          :body='$t("marketplace.operatorBranchEconomyPage.emptyExpensesBody")'
        )
          template(#icon)
            q-icon(name='receipt_long', size='48px')

    //- Распределение членских взносов — участники (веса) + ручная команда «Распределить»
    template(v-if='activeKey === "distribution"')
      .economy__section
        BaseTable(
          v-if='firstLoad || (economy && economy.weights.length)',
          :columns='weightColumns',
          :rows='economy ? economy.weights : []',
          row-key='username',
          :loading='firstLoad',
          min-width='830px'
        )
          template(#cell-member='{ row: w }')
            .economy__name {{ nameByUsername[w.username] || w.username }}
          template(#cell-weight='{ row: w }')
            input.economy__weight-input(
              v-if='isBranchTrustee',
              type='number',
              min='1',
              :value='editWeights[w.username] ?? w.weight',
              @input='onWeightInput(w.username, $event)',
              @change='onUpdateWeight(w.username)'
            )
            template(v-else) {{ w.weight }}
          template(#cell-share='{ row: w }')
            | {{ w.share_percent.toFixed(1) }} %
          template(#cell-balance='{ row: w }')
            span.t-mono {{ formatAsset2Digits(w.personal_balance) }}
          template(#cell-actions='{ row: w }')
            BaseButton(
              variant='ghost',
              icon-only,
              size='sm',
              :aria-label='$t("marketplace.operatorBranchEconomyPage.excludeAriaLabel")',
              :disabled='weightSaving',
              @click='onDeleteWeight(w.username)'
            )
              template(#icon-left)
                q-icon(name='person_remove', size='18px')

        .banner.banner--info(v-else-if='economy')
          q-icon.banner__icon(name='info', size='18px')
          .banner__body
            | {{ $t('marketplace.operatorBranchEconomyPage.noWeightsHintIntro') }}
            | {{ $t('marketplace.operatorBranchEconomyPage.noWeightsHintTail') }}

        .economy__add(v-if='isBranchTrustee && weightCandidates.length')
          BaseSelect.economy__add-select(
            v-model='newWeightUsername',
            :label='$t("marketplace.operatorBranchEconomyPage.participantSelectLabel")',
            :options='weightCandidates'
          )
          AmountInput.economy__add-weight(
            v-model='newWeightValue',
            :label='$t("marketplace.operatorBranchEconomyPage.columnWeight")',
            :precision='0',
            :min='1'
          )
          BaseButton(
            variant='primary',
            :loading='weightSaving',
            :disabled='!newWeightUsername',
            @click='onAddWeight'
          ) {{ $t('marketplace.operatorBranchEconomyPage.addToDistributionAction') }}

    //- Мои средства — свободная доля (получена после распределения) и лента
    //- выплат: каждое «Получить» превращается в карточку своего статуса.
    template(v-if='activeKey === "personal"')
      .economy__cards
        WalletCard(
          program='wallet',
          :title='$t("marketplace.operatorBranchEconomyPage.myFreeFundsTitle")',
          :subtitle='$t("marketplace.operatorBranchEconomyPage.myFreeFundsSubtitle")',
          :balance='assetAmount(personalBalance).toFixed(2)',
          :symbol='assetSymbol(personalBalance)',
          :loading='loading && !personalBalance'
        )

      //- Заявления на материальную помощь в процессе: пока совет не принял
      //- решение — показываем стадию рассмотрения, после одобрения — реальный
      //- статус выплаты у кассира.
      .economy__section(v-if='aids.length')
        .economy__section-title {{ $t('marketplace.operatorBranchEconomyPage.inProgressLabel') }}
        .economy__payout-cards
          BaseCard(v-for='a in aids', :key='a.hash')
            template(#head)
              div
                .t-mono.economy__payout-amount {{ formatAsset2Digits(a.amount) }}
                .t-muted {{ $t('marketplace.operatorBranchEconomyPage.aidLabel') }}
              BaseBadge(:variant='aidStageVariant(a)') {{ aidStageLabel(a) }}
            .t-muted(v-if='a.stage === "ON_COUNCIL"')
              | {{ $t('marketplace.operatorBranchEconomyPage.aidUnderReviewHint') }}
            .t-muted(v-if='a.payment_destination') {{ $t('marketplace.operatorBranchEconomyPage.payoutDestinationLabel', { destination: a.payment_destination }) }}

      //- История завершённых получений (перевод в Стол заказов + выплаченная
      //- материальная помощь) — движения персонального кошелька ledger2.
      //- Список однородный, поэтому таблица, как у общего кошелька участка.
      .economy__section(v-if='personalWalletHistory.length')
        .economy__section-title {{ $t('marketplace.operatorBranchEconomyPage.historyTitle') }}
        BaseTable(
          :columns='personalHistoryColumns',
          :rows='personalWalletHistory',
          row-key='global_sequence',
          min-width='780px'
        )
          template(#cell-date='{ row: op }')
            span.t-mono {{ formatDateToLocalTimezone(op.created_at, 'DD.MM.YYYY HH:mm') }}
          template(#cell-operation='{ row: op }')
            | {{ operationLabel({ operationCode: op.operation_code, action: 'apply' }) }}
          template(#cell-amount='{ row: op }')
            span.t-mono {{ formatProcessAmount(op.quantity) }}
          template(#cell-status)
            BaseBadge(variant='pos') {{ $t('marketplace.operatorBranchEconomyPage.completedLabel') }}

      EmptyState(
        v-if='!firstLoad && !aids.length && !personalWalletHistory.length',
        :title='$t("marketplace.operatorBranchEconomyPage.emptyReceiptsTitle")',
        :body='$t("marketplace.operatorBranchEconomyPage.emptyReceiptsBody")'
      )
        template(#icon)
          q-icon(name='payments', size='48px')

  //- Оплата планового расхода — общий диалог шасси расходов: он собирает
  //- позиции, формирует служебную записку и берёт подпись, а подача на цепь
  //- (выделение средств участка + постановка на совет) — в submit.
  ExpenseCreateDialog(
    v-model='payPlanOpen',
    :title='$t("marketplace.operatorBranchEconomyPage.payExpenseDialogTitle")',
    :source-wallet='BRANCH_EXPENSE_SOURCE_WALLET',
    :draft-key='payPlanDraftKey',
    :prefill='payPlanPrefill',
    :submit='submitBranchExpense',
    @created='onBranchExpenseCreated'
  )

  //- Диалог добавления планового расхода
  BaseDialog(v-model='addPlanOpen', :title='$t("marketplace.operatorBranchEconomyPage.newExpenseDialogTitle")', size='md')
    //- Поля идут плотно: каждое из них уже резервирует строку под подсказку,
    //- и дополнительный зазор растягивал короткую форму на весь экран.
    .economy__dialog-body.economy__plan-form
      BaseInput(v-model='planTitle', :label='$t("marketplace.operatorBranchEconomyPage.expensePurposeLabel")')
      AmountInput(v-model='planAmount', :label='$t("marketplace.operatorBranchEconomyPage.amountLabel")', :precision='2', :min='0')
      BaseInput(v-model='planDueDate', :label='$t("marketplace.operatorBranchEconomyPage.payByDateLabel")', type='date')
      BaseSelect(v-model='planRecurrence', :label='$t("marketplace.operatorBranchEconomyPage.recurrenceLabel")', :options='planRecurrenceOptions')
      BaseInput(v-model='planPayTo', :label='$t("marketplace.operatorBranchEconomyPage.paymentDetailsLabel")')
    template(#footer)
      BaseButton(variant='ghost', :disabled='planSaving', @click='addPlanOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(
        variant='primary',
        :loading='planSaving',
        :disabled='!planTitle || !planAmount || !planDueDate',
        @click='onAddPlan'
      ) {{ $t('marketplace.operatorBranchEconomyPage.addExpenseAction') }}

  //- Диалог распределения
  BaseDialog(v-model='distributeOpen', :title='$t("marketplace.operatorBranchEconomyPage.distributeDialogTitle")', size='sm')
    .economy__dialog-body
      p
        | {{ $t('marketplace.operatorBranchEconomyPage.distributeHintIntro') }}
        | {{ $t('marketplace.operatorBranchEconomyPage.distributeHintPartial') }}
        | {{ $t('marketplace.operatorBranchEconomyPage.distributeHintReserve') }}
      AmountInput(
        v-model='distributeAmount',
        :label='$t("marketplace.operatorBranchEconomyPage.distributionAmountLabel")',
        :symbol='economy ? assetSymbol(economy.common_balance) : ""',
        :precision='2',
        :min='0',
        show-max,
        show-balance,
        :balance='availableToDistribute'
      )
    template(#footer)
      BaseButton(variant='ghost', :disabled='distributing', @click='distributeOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='distributing', :disabled='!distributeAmount', @click='onDistribute') {{ $t('marketplace.operatorBranchEconomyPage.distributeAction') }}

  //- Диалог «Получить» — сумма делится между Столом заказов (мгновенно) и
  //- материальной помощью (заявление → подпись → выплата кассиром).
  //- На шаге заявления разворачиваем диалог на весь экран — канон просмотра
  //- и подписания документов (в 640px лист документа не читается).
  BaseDialog(
    v-model='getFundsOpen',
    :title='$t("marketplace.operatorBranchEconomyPage.receiveFundsDialogTitle")',
    size='md'
  )
    .economy__dialog-body
      p
        | {{ $t('marketplace.operatorBranchEconomyPage.aidHintIntro') }}
        | {{ $t('marketplace.operatorBranchEconomyPage.aidHintApproval') }}
        | {{ $t('marketplace.operatorBranchEconomyPage.aidHintTax') }}
        | {{ $t('marketplace.operatorBranchEconomyPage.aidHintTaxTail') }}
      AmountInput(
        v-model='aidPart',
        :label='$t("marketplace.operatorBranchEconomyPage.aidRadioLabel")',
        :symbol='assetSymbol(personalBalance)',
        :precision='2',
        :min='0'
      )
      //- Разбивка удержания: человек вписал одну сумму, а на счёт придёт
      //- меньше — без этой строки разница читается как ошибка выплаты.
      .economy__tax-breakdown(v-if='Number(aidPart) > 0')
        .economy__tax-row
          span {{ $t('marketplace.operatorBranchEconomyPage.accruedLabel') }}
          span {{ aidGross.toFixed(2) }} {{ assetSymbol(personalBalance) }}
        .economy__tax-row
          span {{ $t('marketplace.operatorBranchEconomyPage.taxWithheldLabel', { percent: NDFL_RATE_PERCENT }) }}
          span −{{ aidTax.toFixed(2) }} {{ assetSymbol(personalBalance) }}
        .economy__tax-row.economy__tax-row--total
          span {{ $t('marketplace.operatorBranchEconomyPage.toTransferLabel') }}
          span {{ aidNet.toFixed(2) }} {{ assetSymbol(personalBalance) }}
        //- Без этой сноски округление читается как ошибка: с 10 ₽ тринадцать
        //- процентов — это 1,30, а удерживается ровно рубль.
        p.economy__tax-note
          | {{ $t('marketplace.operatorBranchEconomyPage.taxRoundingHintIntro') }}
          | {{ $t('marketplace.operatorBranchEconomyPage.taxRoundingHintTail') }}
      PaymentMethodSelect(
        v-if='Number(aidPart) > 0',
        v-model='aidPaymentMethodId',
        :username='session.username',
        required
      )
      p.economy__get-funds-total(:class='{ "economy__get-funds-total--over": getFundsOverBalance }')
        | {{ $t('marketplace.operatorBranchEconomyPage.totalAvailableLabel', { available: getFundsTotal.toFixed(2), total: assetAmount(personalBalance).toFixed(2), symbol: assetSymbol(personalBalance) }) }}
      //- Заявление о материальной помощи подписывается под капотом: читать
      //- типовой текст перед подписью незачем, подписанный документ виден в
      //- заявке.
      p.economy__get-funds-note(v-if='Number(aidPart) > 0')
        | {{ $t('marketplace.operatorBranchEconomyPage.autoSignHintIntro') }}
        | {{ $t('marketplace.operatorBranchEconomyPage.autoSignHintTail') }}
    template(#footer)
      BaseButton(
        variant='ghost',
        :disabled='getFundsSubmitting',
        @click='getFundsOpen = false'
      ) {{ $t('common.action.cancel') }}
      BaseButton(
        variant='primary',
        :loading='getFundsSubmitting',
        :disabled='getFundsTotal <= 0 || getFundsOverBalance',
        @click='onGetFunds'
      ) {{ $t('marketplace.operatorBranchEconomyPage.receiveAction') }}

  //- Заказ из движения кошелька — оверлеем поверх экономики (`?order=<id>`).
  OrderRegistryOverlay(
    :coopname='coopname',
    full-page-route-name='marketplace-pvz-order-detail',
    from='economy'
  )
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

  &__tax-breakdown {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
    padding: var(--p-3, 12px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    background: var(--p-surface-2);
  }

  &__tax-note {
    margin: var(--p-2, 8px) 0 0;
    color: var(--p-ink-3);
    font-size: var(--p-fs-meta, 12px);
    line-height: var(--p-lh-meta, 1.4);
  }

  &__tax-row {
    display: flex;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
    font-variant-numeric: tabular-nums;

    &--total {
      color: var(--p-ink);
      font-weight: 600;
      padding-top: var(--p-1, 4px);
      border-top: 1px solid var(--p-line);
    }
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
