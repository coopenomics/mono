<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { uiLocale, t as i18nT } from 'src/shared/i18n';
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables'
import { useRoute } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useSessionStore } from 'src/entities/Session'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { DigitalDocument } from 'src/shared/lib/document'
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseInput, BaseSelect, BaseTable, EmptyState } from 'src/shared/ui/base'
import type { BaseBadgeVariant, BaseTableColumn } from 'src/shared/ui/base'
import { ActivityTimeline, AmountInput, DataRow, DetailsDrawer, PageHint, WalletCard, type ActivityEvent } from 'src/shared/ui/domain'
import { ProcessDetailCard } from 'src/widgets/Process/ProcessDetailCard'
import { ExpenseCreateDialog, type ExpenseCreatePayload } from 'src/shared/ui/domain/ExpenseCreateDialog'
import { PaymentMethodSelect } from 'src/shared/ui/domain/PaymentMethodSelect'
import { PageTabs, type PageTab } from 'src/shared/ui/layout'
import { TurnoverTop } from 'src/widgets/Marketplace/TurnoverTop'
import { OrderRegistryOverlay } from 'src/widgets/Marketplace/OrderRegistryOverlay'
import { OfferRegistryOverlay } from 'src/widgets/Marketplace/OfferRegistryOverlay'
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
  type MarketplaceBranchCurrentPeriodView,
  type MarketplaceBranchInitiatorView,
  type MarketplaceBranchPeriodRow,
  type MarketplaceBranchReserveRow,
  type MarketplaceBranchReservesView,
  type MarketplaceBranchEconomyView,
  type MarketplaceBranchWalletHistoryView,
  type MarketplacePersonalWalletHistoryView,
  createAid,
  createBranchExpense,
  type ICreateBranchExpenseInput,
  createExpensePlan,
  deleteExpensePlan,
  deleteBranchReserve,
  deleteTrusteeWeight,
  distributeBranchFunds,
  getAidStatementSignablePayload,
  getBranchCurrentPeriod,
  getBranchEconomy,
  getBranchInitiator,
  getBranchReserves,
  getBranchWalletHistory,
  getPersonalEconomy,
  getPersonalWalletHistory,
  listAids,
  listBranchPeriods,
  listExpensePlans,
  setBranchReserve,
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
 *  5. «Итоги месяцев» (коэффициент экономического участия, 99D-23) — по
 *     одной строке на прогон первого числа: стоимость списанных заказов,
 *     собранная обеспечительная часть, расходы участка, фонды, участку,
 *     инициатору, пайщикам обратно, дефицит и ставка списания; текущий месяц
 *     показан как «идёт».
 *  6. «Резерв матпомощи» — резерв социально-экономического обеспечения
 *     пайщиков по получателям (решение владельца 04.11.2026 — отдельный
 *     раздел страницы): строка — предел материальной помощи получателя за
 *     месяц, сумма строк — расход участка в итоге месяца; кнопка «Добавить
 *     получателя» у председателя участка стоит справа в строке разделов.
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
const reserves = ref<MarketplaceBranchReservesView | null>(null)
const initiator = ref<MarketplaceBranchInitiatorView | null>(null)
const periods = ref<MarketplaceBranchPeriodRow[]>([])
const currentPeriod = ref<MarketplaceBranchCurrentPeriodView | null>(null)

// ─── Табы страницы (requirement — переверстка без изменения логики) ───

const activeKey = ref<'wallet' | 'turnover' | 'expenses' | 'reserve' | 'distribution' | 'personal' | 'periods'>('wallet')

const tabs = computed<PageTab[]>(() => [
  { key: 'wallet', label: i18nT('marketplace.operatorBranchEconomyPage.walletTabLabel') },
  { key: 'turnover', label: i18nT('marketplace.operatorBranchEconomyPage.turnoverTabLabel') },
  { key: 'expenses', label: i18nT('marketplace.operatorBranchEconomyPage.plannedExpensesTabLabel'), count: plans.value.length || undefined },
  { key: 'reserve', label: i18nT('marketplace.operatorBranchEconomyPage.reserveTabLabel'), count: reserveRows.value.length || undefined },
  { key: 'distribution', label: i18nT('marketplace.operatorBranchEconomyPage.distributionTabLabel'), count: economy.value?.weights.length || undefined },
  { key: 'personal', label: i18nT('marketplace.operatorBranchEconomyPage.myFundsTabLabel') },
  { key: 'periods', label: i18nT('marketplace.operatorBranchEconomyPage.periodsTabLabel'), count: periods.value.length || undefined },
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
  if (aid.stage === Zeus.MarketplaceAidStage.ON_COUNCIL) return i18nT('marketplace.operatorBranchEconomyPage.statusUnderCouncilReview')
  return paymentStatusLabel(aid.payment_status)
}

function aidStageVariant(aid: MarketplaceAidView): BaseBadgeVariant {
  if (aid.stage === Zeus.MarketplaceAidStage.ON_COUNCIL) return 'info'
  return paymentStatusVariant(aid.payment_status)
}

/** Процесс материальной помощи: его хэш — хэш заявления (реестр процессов ядра). */
const AID_PROCESS_TYPE = 'p.brn.aid'

const aidColumns = computed<BaseTableColumn<MarketplaceAidView>[]>(() => [
  { key: 'submitted', label: i18nT('marketplace.operatorBranchEconomyPage.aidColumnSubmitted'), width: '170px', nowrap: true },
  { key: 'amount', label: i18nT('marketplace.operatorBranchEconomyPage.aidColumnAmount'), width: '150px', numeric: true },
  { key: 'net', label: i18nT('marketplace.operatorBranchEconomyPage.aidColumnNet'), width: '150px', numeric: true },
  { key: 'destination', label: i18nT('marketplace.operatorBranchEconomyPage.aidColumnDestination'), width: '220px' },
  { key: 'stage', label: i18nT('marketplace.operatorBranchEconomyPage.columnStatus'), width: '220px', nowrap: true },
])

/** Выбранное заявление живёт по хэшу: после перечитывания списка панель показывает свежую строку. */
const selectedAidHash = ref<string | null>(null)
const selectedAid = computed(() => aids.value.find((a) => a.hash === selectedAidHash.value) ?? null)
const aidDrawerOpen = computed({
  get: () => selectedAid.value !== null,
  set: (open: boolean) => {
    if (!open) selectedAidHash.value = null
  },
})

function openAid(row: MarketplaceAidView): void {
  selectedAidHash.value = row.hash
}

/** Вехи заявления, которые уже наступили: подача → решение совета → платёж у кассира. */
const aidEvents = computed<ActivityEvent[]>(() => {
  const a = selectedAid.value
  if (!a) return []
  const at = (d: unknown) => formatDateToLocalTimezone(d as string, 'DD.MM.YYYY HH:mm')
  const ev: ActivityEvent[] = []
  if (a.submitted_at) ev.push({ id: 'submitted', type: 'sign', icon: 'edit_document', title: i18nT('marketplace.operatorBranchEconomyPage.aidEventSubmitted'), date: at(a.submitted_at) })
  if (a.decided_at) ev.push({ id: 'decided', type: 'sign', icon: 'gavel', title: i18nT('marketplace.operatorBranchEconomyPage.aidEventDecided'), date: at(a.decided_at) })
  if (a.payment_created_at) ev.push({ id: 'payment', type: 'transfer', icon: 'payments', title: i18nT('marketplace.operatorBranchEconomyPage.aidEventPaymentCreated'), description: a.payment_destination || undefined, date: at(a.payment_created_at) })
  if (a.payment_completed_at) ev.push({ id: 'paid', type: 'transfer', icon: 'task_alt', title: i18nT('marketplace.operatorBranchEconomyPage.aidEventPaid'), date: at(a.payment_completed_at) })
  if (a.payment_failed_at) ev.push({ id: 'failed', type: 'reject', title: i18nT('marketplace.operatorBranchEconomyPage.aidEventFailed'), date: at(a.payment_failed_at) })
  return ev
})

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

/** Сколько итогов месяцев показываем: год прогонов. */
const PERIODS_LIMIT = 12

async function loadAll(): Promise<void> {
  if (!braname.value) return
  loading.value = true
  try {
    const [branchEconomy, branchPlans, personal, myAids, history, personalHistory, branchReserves, branchInitiator, branchPeriods, current] = await Promise.all([
      getBranchEconomy(braname.value),
      listExpensePlans(braname.value),
      getPersonalEconomy(),
      listAids(),
      getBranchWalletHistory(braname.value, { page: 1, limit: 20, sortOrder: 'DESC' }),
      getPersonalWalletHistory({ page: 1, limit: 20, sortOrder: 'DESC' }),
      getBranchReserves(braname.value),
      getBranchInitiator(braname.value),
      listBranchPeriods(braname.value, { page: 1, limit: PERIODS_LIMIT, sortOrder: 'DESC' }),
      getBranchCurrentPeriod(braname.value),
    ])
    economy.value = branchEconomy
    plans.value = branchPlans
    personalBalance.value = personal.personal_balance
    aids.value = myAids
    walletHistory.value = history.items
    personalWalletHistory.value = personalHistory.items
    reserves.value = branchReserves
    initiator.value = branchInitiator
    periods.value = branchPeriods.items
    currentPeriod.value = current
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
    { code: 'marketplace', table: 'marketplace_branch_period' },
    { code: 'marketplace', table: 'marketplace_branch_aid' },
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

// ─── Резерв социально-экономического обеспечения пайщиков (председатель КУ) ───
//
// Строка резерва — предел материальной помощи получателя за месяц; сумму
// строк контракт учитывает расходом участка при расчёте итога месяца. Верхний
// предел строки ставит администратор кооператива; ноль выключает резерв целиком.

const { confirm } = useConfirm()

const reserveLimit = computed(() => (reserves.value ? assetAmount(reserves.value.limit) : 0))
const reserveEnabled = computed(() => reserveLimit.value > 0)
const reserveSymbol = computed(() => (reserves.value ? assetSymbol(reserves.value.limit) : assetSymbol(personalBalance.value)))
const reserveRows = computed<MarketplaceBranchReserveRow[]>(() => reserves.value?.rows ?? [])
/** Резерв участка в месяц — сумма строк для карточки; итог месяца считает контракт сам. */
const reserveTotal = computed(() => reserveRows.value.reduce((sum, r) => sum + assetAmount(String(r.amount)), 0))

const reserveColumns = computed<BaseTableColumn<MarketplaceBranchReserveRow>[]>(() => [
  { key: 'recipient', label: i18nT('marketplace.operatorBranchEconomyPage.reserveColumnRecipient'), width: '260px' },
  { key: 'amount', label: i18nT('marketplace.operatorBranchEconomyPage.reserveColumnAmount'), width: '170px', numeric: true },
  { key: 'submitted', label: i18nT('marketplace.operatorBranchEconomyPage.reserveColumnSubmitted'), width: '190px', numeric: true },
  { key: 'remaining', label: i18nT('marketplace.operatorBranchEconomyPage.reserveColumnRemaining'), width: '150px', numeric: true },
  ...(isBranchTrustee.value
    ? [{ key: 'actions', label: '', width: '120px' } as BaseTableColumn<MarketplaceBranchReserveRow>]
    : []),
])

/** Кандидаты в получатели — председатель и доверенные лица участка без строки резерва. */
const reserveCandidates = computed(() => {
  const b = branch.value
  if (!b || !b.trustee) return []
  const present = new Set(reserveRows.value.map((r) => r.username))
  return [b.trustee, ...(b.trusted ?? [])]
    .filter((p) => !present.has(p.username))
    .map((p) => ({ label: personName(p), value: p.username }))
})

const reserveDialogOpen = ref(false)
const reserveEditing = ref(false)
const reserveUsername = ref<string | null>(null)
const reserveAmount = ref<number | null>(null)
const reserveSaving = ref(false)

const reserveOverLimit = computed(() => Number(reserveAmount.value) > reserveLimit.value)

function openAddReserve(): void {
  reserveEditing.value = false
  reserveUsername.value = reserveCandidates.value[0]?.value ?? null
  reserveAmount.value = null
  reserveDialogOpen.value = true
}

function openEditReserve(row: MarketplaceBranchReserveRow): void {
  reserveEditing.value = true
  reserveUsername.value = row.username
  reserveAmount.value = assetAmount(row.amount)
  reserveDialogOpen.value = true
}

async function onSaveReserve(): Promise<void> {
  const amount = Number(reserveAmount.value)
  if (!braname.value || !reserveUsername.value || !Number.isFinite(amount) || amount <= 0 || reserveOverLimit.value) return
  reserveSaving.value = true
  try {
    reserves.value = await setBranchReserve({ braname: braname.value, username: reserveUsername.value, amount })
    SuccessAlert(i18nT('marketplace.operatorBranchEconomyPage.reserveSavedMessage'))
    reserveDialogOpen.value = false
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorBranchEconomyPage.reserveSaveFailedMessage'))
  } finally {
    reserveSaving.value = false
  }
}

async function onDeleteReserve(row: MarketplaceBranchReserveRow): Promise<void> {
  if (!braname.value) return
  const ok = await confirm({
    title: i18nT('marketplace.operatorBranchEconomyPage.reserveDeleteTitle'),
    message: i18nT('marketplace.operatorBranchEconomyPage.reserveDeleteMessage', { name: nameByUsername.value[row.username] || row.username }),
    confirmLabel: i18nT('marketplace.operatorBranchEconomyPage.reserveDeleteAction'),
    danger: true,
  })
  if (!ok) return
  reserveSaving.value = true
  try {
    reserves.value = await deleteBranchReserve({ braname: braname.value, username: row.username })
    SuccessAlert(i18nT('marketplace.operatorBranchEconomyPage.reserveDeletedMessage'))
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorBranchEconomyPage.reserveDeleteFailedMessage'))
  } finally {
    reserveSaving.value = false
  }
}

/** Строка резерва текущего пользователя: её остаток — предел его заявления на месяц. */
const myReserve = computed(() => reserveRows.value.find((r) => r.username === session.username) ?? null)
const myReserveRemaining = computed(() => (myReserve.value ? assetAmount(myReserve.value.remaining) : 0))

// ─── Инициатор участка и его паевой кошелёк ───

const initiatorName = computed(() => {
  const u = initiator.value?.username
  if (!u) return ''
  return nameByUsername.value[u] || u
})

// ─── Итоги месяцев участка ───

/** Месяц по его номеру (год × 12 + месяц): «ноябрь 2026». */
function monthLabel(period: number): string {
  const year = Math.floor((period - 1) / 12)
  const month = (period - 1) % 12
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString(uiLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const periodColumns: BaseTableColumn<MarketplaceBranchPeriodRow>[] = [
  { key: 'month', label: i18nT('marketplace.operatorBranchEconomyPage.periodColumnMonth'), width: '150px', nowrap: true },
  { key: 'turnover', label: i18nT('marketplace.operatorBranchEconomyPage.periodColumnTurnover'), width: '150px', numeric: true },
  { key: 'secured', label: i18nT('marketplace.operatorBranchEconomyPage.periodColumnSecured'), width: '140px', numeric: true },
  { key: 'expenses', label: i18nT('marketplace.operatorBranchEconomyPage.periodColumnExpenses'), width: '140px', numeric: true },
  { key: 'funds_amount', label: i18nT('marketplace.operatorBranchEconomyPage.periodColumnFunds'), width: '130px', numeric: true },
  { key: 'branch_amount', label: i18nT('marketplace.operatorBranchEconomyPage.periodColumnBranch'), width: '130px', numeric: true },
  { key: 'initiator_amount', label: i18nT('marketplace.operatorBranchEconomyPage.periodColumnInitiator'), width: '130px', numeric: true },
  { key: 'return_amount', label: i18nT('marketplace.operatorBranchEconomyPage.periodColumnReturned'), width: '140px', numeric: true },
  { key: 'deficit', label: i18nT('marketplace.operatorBranchEconomyPage.periodColumnDeficit'), width: '130px', numeric: true },
  { key: 'rate_percent', label: i18nT('marketplace.operatorBranchEconomyPage.periodColumnRate'), width: '110px', numeric: true },
]

const selectedPeriod = ref<MarketplaceBranchPeriodRow | null>(null)
const periodDrawerOpen = computed({
  get: () => selectedPeriod.value !== null,
  set: (open: boolean) => { if (!open) selectedPeriod.value = null },
})

function openPeriod(row: MarketplaceBranchPeriodRow): void {
  selectedPeriod.value = row
}

function ratePercentLabel(rate: string): string {
  return `${rate.replace('.', ',')} %`
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
// Предел материальной помощи за месяц — строка резерва получателя. Контракт
// держит то же правило (BRANCH_AID_OVER_RESERVE); здесь отказ виден до отправки.
const aidNoReserve = computed(() => reserveEnabled.value && !myReserve.value)
const aidOverReserve = computed(() => reserveEnabled.value && !!myReserve.value && getFundsTotal.value > myReserveRemaining.value)

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
  if (getFundsOverBalance.value || aidNoReserve.value || aidOverReserve.value) return
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
      template(v-else-if='activeKey === "reserve" && isBranchTrustee && reserveEnabled && reserveCandidates.length', #actions)
        BaseButton(variant='primary', size='sm', :disabled='reserveSaving', @click='openAddReserve')
          template(#icon-left)
            q-icon(name='person_add', size='16px')
          | {{ $t('marketplace.operatorBranchEconomyPage.reserveAddAction') }}
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
        //- Паевой кошелёк инициатора участка — доля инициатора в экономии
        //- месяцев. В общий кошелёк участка он не входит: это паевой взнос
        //- пайщика по договору участия в хозяйственной деятельности.
        WalletCard(
          neutral,
          icon='trending_up',
          :title='$t("marketplace.operatorBranchEconomyPage.initiatorWalletTitle")',
          :subtitle='initiatorName',
          :hint='$t("marketplace.operatorBranchEconomyPage.initiatorWalletHint")',
          :balance='initiator ? assetAmount(initiator.invest_balance).toFixed(2) : "0.00"',
          :symbol='initiator ? assetSymbol(initiator.invest_balance) : ""',
          :loading='loading && !initiator'
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

    //- Резерв материальной помощи (резерв социально-экономического обеспечения
    //- пайщиков): строка на получателя в месяц, её остаток — предел заявления
    //- на материальную помощь, сумма строк — расход участка в итоге месяца.
    //- Председатель участка ведёт строки, потолок строки ставит администратор.
    template(v-if='activeKey === "reserve"')
      //- Как на соседних вкладках: пара карточек над таблицей — верхний предел
      //- строки (ставит администратор) и резерв участка в месяц (сумма строк,
      //- расход участка в итоге месяца). Нет предела — резерв выключен целиком.
      template(v-if='reserveEnabled')
        .economy__cards
          WalletCard(
            program='wallet',
            icon='vertical_align_top',
            :title='$t("marketplace.operatorBranchEconomyPage.reserveLimitTitle")',
            :subtitle='$t("marketplace.operatorBranchEconomyPage.reserveLimitSubtitle")',
            :balance='reserveLimit.toFixed(2)',
            :symbol='reserveSymbol',
            :loading='loading && !reserves'
          )
          WalletCard(
            program='wallet',
            icon='volunteer_activism',
            :title='$t("marketplace.operatorBranchEconomyPage.reserveTotalTitle")',
            :subtitle='$t("marketplace.operatorBranchEconomyPage.reserveTotalSubtitle")',
            :balance='reserveTotal.toFixed(2)',
            :symbol='reserveSymbol',
            :loading='loading && !reserves'
          )

        .economy__section
          BaseTable(
            v-if='firstLoad || reserveRows.length',
            :columns='reserveColumns',
            :rows='reserveRows',
            row-key='username',
            :loading='firstLoad',
            min-width='780px'
          )
            template(#cell-recipient='{ row: r }')
              .economy__name {{ nameByUsername[r.username] || r.username }}
            template(#cell-amount='{ row: r }')
              span.t-mono {{ formatAsset2Digits(r.amount) }}
            template(#cell-submitted='{ row: r }')
              span.t-mono {{ formatAsset2Digits(r.submitted) }}
            template(#cell-remaining='{ row: r }')
              span.t-mono {{ formatAsset2Digits(r.remaining) }}
            template(#cell-actions='{ row: r }')
              .economy__row-actions
                BaseButton(variant='secondary', size='sm', :disabled='reserveSaving', @click='openEditReserve(r)') {{ $t('marketplace.operatorBranchEconomyPage.reserveEditAction') }}
                BaseButton(
                  variant='ghost',
                  icon-only,
                  size='sm',
                  :aria-label='$t("marketplace.operatorBranchEconomyPage.reserveDeleteAction")',
                  :disabled='reserveSaving',
                  @click='onDeleteReserve(r)'
                )
                  template(#icon-left)
                    q-icon(name='person_remove', size='18px')

          EmptyState(
            v-if='!firstLoad && !reserveRows.length',
            :title='$t("marketplace.operatorBranchEconomyPage.reserveEmptyTitle")',
            :body='$t("marketplace.operatorBranchEconomyPage.reserveEmptyBody")'
          )
            template(#icon)
              q-icon(name='volunteer_activism', size='48px')

      EmptyState(
        v-else-if='reserves',
        :title='$t("marketplace.operatorBranchEconomyPage.reserveOffTitle")',
        :body='$t("marketplace.operatorBranchEconomyPage.reserveOffBody")'
      )
        template(#icon)
          q-icon(name='volunteer_activism', size='48px')

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

      //- Заявления на материальную помощь — таблицей на всю ширину: дата, сумма,
      //- на счёт, реквизиты, состояние. Пока совет не решил — бейдж рассмотрения,
      //- после одобрения — статус выплаты у кассира. Строка открывает панель
      //- процесса справа: вехи, документы, операции.
      .economy__section(v-if='aids.length')
        .economy__section-title {{ $t('marketplace.operatorBranchEconomyPage.aidsTitle') }}
        BaseTable(
          :columns='aidColumns',
          :rows='aids',
          row-key='hash',
          min-width='780px',
          clickable-rows,
          @row-click='openAid'
        )
          template(#cell-submitted='{ row: a }')
            span.t-mono {{ a.submitted_at ? formatDateToLocalTimezone(a.submitted_at, 'DD.MM.YYYY HH:mm') : '—' }}
          template(#cell-amount='{ row: a }')
            span.t-mono {{ formatAsset2Digits(a.amount) }}
          template(#cell-net='{ row: a }')
            span.t-mono {{ formatAsset2Digits(a.net_amount) }}
          template(#cell-destination='{ row: a }')
            | {{ a.payment_destination || '—' }}
          template(#cell-stage='{ row: a }')
            BaseBadge(:variant='aidStageVariant(a)') {{ aidStageLabel(a) }}

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

    //- Итоги месяцев: по строке на прогон первого числа; строка открывает состав
    //- расходов и прогона справа. Текущий месяц идёт — расходы на сегодня,
    //- резерв и заказы, которые созреют к первому числу; ставок у него нет.
    template(v-if='activeKey === "periods"')
      BaseCard.economy__current(v-if='currentPeriod')
        template(#head)
          div
            .t-h3 {{ $t('marketplace.operatorBranchEconomyPage.currentPeriodTitle', { month: monthLabel(currentPeriod.period) }) }}
            .t-muted {{ $t('marketplace.operatorBranchEconomyPage.currentPeriodSubtitle') }}
          BaseBadge(variant='info') {{ $t('marketplace.operatorBranchEconomyPage.currentPeriodBadge') }}
        .economy__current-grid
          .economy__current-col
            DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodPlanned")', :value='formatAsset2Digits(currentPeriod.planned)', mono)
            DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodMemos")', :value='formatAsset2Digits(currentPeriod.memos)', mono)
            DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodAidReserve")', :value='formatAsset2Digits(currentPeriod.aid_reserve)', mono)
            DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodColumnExpenses")', :value='formatAsset2Digits(currentPeriod.expenses)', mono)
          .economy__current-col
            DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodAidPaid")', :value='formatAsset2Digits(currentPeriod.aid_paid)', mono)
            DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.currentRipeningOrders")', :value='currentPeriod.ripening_orders', mono)
            DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodColumnTurnover")', :value='formatAsset2Digits(currentPeriod.ripening_turnover)', mono)
            DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodColumnSecured")', :value='formatAsset2Digits(currentPeriod.ripening_secured)', mono)

      BaseTable(
        v-if='firstLoad || periods.length',
        :columns='periodColumns',
        :rows='periods',
        row-key='period',
        :loading='firstLoad',
        min-width='1360px',
        clickable-rows,
        @row-click='openPeriod'
      )
        template(#cell-month='{ row: p }')
          .economy__name {{ monthLabel(p.period) }}
          .economy__due-note(v-if='p.deficit && assetAmount(p.deficit) > 0')
            q-icon(name='trending_down', size='14px')
            | {{ $t('marketplace.operatorBranchEconomyPage.periodDeficitNote') }}
        template(#cell-turnover='{ row: p }')
          span.t-mono {{ formatAsset2Digits(p.turnover) }}
        template(#cell-secured='{ row: p }')
          span.t-mono {{ formatAsset2Digits(p.secured) }}
        template(#cell-expenses='{ row: p }')
          span.t-mono {{ formatAsset2Digits(p.expenses) }}
        template(#cell-funds_amount='{ row: p }')
          span.t-mono {{ formatAsset2Digits(p.funds_amount) }}
        template(#cell-branch_amount='{ row: p }')
          span.t-mono {{ formatAsset2Digits(p.branch_amount) }}
        template(#cell-initiator_amount='{ row: p }')
          span.t-mono {{ formatAsset2Digits(p.initiator_amount) }}
        template(#cell-return_amount='{ row: p }')
          span.t-mono {{ formatAsset2Digits(p.return_amount) }}
        template(#cell-deficit='{ row: p }')
          span.t-mono(:class='{ "economy__due--overdue": assetAmount(p.deficit) > 0 }') {{ formatAsset2Digits(p.deficit) }}
        template(#cell-rate_percent='{ row: p }')
          span.t-mono {{ ratePercentLabel(p.rate_percent) }}

      EmptyState(
        v-else-if='!firstLoad',
        :title='$t("marketplace.operatorBranchEconomyPage.periodsEmptyTitle")',
        :body='$t("marketplace.operatorBranchEconomyPage.periodsEmptyBody")'
      )
        template(#icon)
          q-icon(name='event_repeat', size='48px')

  //- Состав итога месяца — правая панель: факты прогона, расчёт контракта,
  //- получатель доли инициатора.
  DetailsDrawer(v-model='periodDrawerOpen', :title='selectedPeriod ? monthLabel(selectedPeriod.period) : ""')
    template(v-if='selectedPeriod')
      .economy__drawer-amount
        .t-muted {{ $t('marketplace.operatorBranchEconomyPage.periodMembership') }}
        .economy__drawer-sum {{ formatAsset2Digits(selectedPeriod.membership) }}
        .t-muted {{ $t('marketplace.operatorBranchEconomyPage.periodRateLine', { rate: ratePercentLabel(selectedPeriod.rate_percent) }) }}
      .economy__drawer-group
        .economy__section-title {{ $t('marketplace.operatorBranchEconomyPage.periodFactsTitle') }}
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodColumnTurnover")', :value='formatAsset2Digits(selectedPeriod.turnover)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodColumnSecured")', :value='formatAsset2Digits(selectedPeriod.secured)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodRowsLine")', :value='`${selectedPeriod.rows_charged} / ${selectedPeriod.rows_total}`', mono)
      .economy__drawer-group
        .economy__section-title {{ $t('marketplace.operatorBranchEconomyPage.periodExpensesTitle') }}
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodPlanned")', :value='formatAsset2Digits(selectedPeriod.planned)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodMemos")', :value='formatAsset2Digits(selectedPeriod.memos)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodAidReserve")', :value='formatAsset2Digits(selectedPeriod.aid_reserve)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodAidUnpaid")', :value='formatAsset2Digits(selectedPeriod.aid_unpaid)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodAidPaid")', :value='formatAsset2Digits(selectedPeriod.aid_paid)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodColumnExpenses")', :value='formatAsset2Digits(selectedPeriod.expenses)', mono)
      .economy__drawer-group
        .economy__section-title {{ $t('marketplace.operatorBranchEconomyPage.periodSplitTitle') }}
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodColumnBranch")', :value='formatAsset2Digits(selectedPeriod.branch_amount)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodColumnFunds")', :value='formatAsset2Digits(selectedPeriod.funds_amount)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodColumnInitiator")', :value='formatAsset2Digits(selectedPeriod.initiator_amount)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodColumnReturned")', :value='formatAsset2Digits(selectedPeriod.return_amount)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodColumnDeficit")', :value='formatAsset2Digits(selectedPeriod.deficit)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodInitiatorLine")', :value='nameByUsername[selectedPeriod.initiator] || selectedPeriod.initiator')
      .t-muted(v-if='selectedPeriod.archived') {{ $t('marketplace.operatorBranchEconomyPage.periodArchivedNote') }}

  //- Заявление на материальную помощь целиком: сумма крупно и состояние,
  //- расчёт выплаты (налог, на счёт), реквизиты, лента вех процесса и карточка
  //- процесса p.brn.aid с документами (заявление, решение совета), операциями и
  //- проводками — тот же виджет, что в карточке заказа.
  DetailsDrawer(v-model='aidDrawerOpen', :title='$t("marketplace.operatorBranchEconomyPage.aidDrawerTitle")', :width='560')
    template(v-if='selectedAid')
      .economy__drawer-amount
        .t-muted {{ $t('marketplace.operatorBranchEconomyPage.aidAmountLabel') }}
        .economy__drawer-sum {{ formatAsset2Digits(selectedAid.amount) }}
        BaseBadge.economy__drawer-badge(:variant='aidStageVariant(selectedAid)') {{ aidStageLabel(selectedAid) }}
      .economy__drawer-group
        .economy__section-title {{ $t('marketplace.operatorBranchEconomyPage.aidPayoutTitle') }}
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.aidTaxLabel")', :value='formatAsset2Digits(selectedAid.ndfl_tax)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.aidNetLabel")', :value='formatAsset2Digits(selectedAid.net_amount)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.aidDestinationLabel")', :value='selectedAid.payment_destination || "—"')
      .economy__drawer-group(v-if='aidEvents.length')
        .economy__section-title {{ $t('marketplace.operatorBranchEconomyPage.aidTimelineTitle') }}
        ActivityTimeline(:events='aidEvents')
      ProcessDetailCard(
        :coopname='coopname',
        :process-hash='selectedAid.hash.toLowerCase()',
        :process-type='AID_PROCESS_TYPE'
      )

  //- Строка резерва получателя: сумма в месяц, не выше верхнего предела кооператива.
  BaseDialog(
    v-model='reserveDialogOpen',
    :title='reserveEditing ? $t("marketplace.operatorBranchEconomyPage.reserveEditTitle") : $t("marketplace.operatorBranchEconomyPage.reserveAddTitle")',
    size='sm'
  )
    .economy__dialog-body
      p {{ $t('marketplace.operatorBranchEconomyPage.reserveDialogHint') }}
      BaseSelect(
        v-if='!reserveEditing',
        v-model='reserveUsername',
        :label='$t("marketplace.operatorBranchEconomyPage.reserveColumnRecipient")',
        :options='reserveCandidates'
      )
      .economy__name(v-else) {{ (reserveUsername && nameByUsername[reserveUsername]) || reserveUsername }}
      AmountInput(
        v-model='reserveAmount',
        :label='$t("marketplace.operatorBranchEconomyPage.reserveColumnAmount")',
        :symbol='reserveSymbol',
        :precision='2',
        :min='0',
        :max='reserveLimit',
        :hint='$t("marketplace.operatorBranchEconomyPage.reserveAmountHint", { limit: reserveLimit.toFixed(2), symbol: reserveSymbol })',
        :error='reserveOverLimit ? $t("marketplace.operatorBranchEconomyPage.reserveOverLimitError") : undefined'
      )
    template(#footer)
      BaseButton(variant='ghost', :disabled='reserveSaving', @click='reserveDialogOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(
        variant='primary',
        :loading='reserveSaving',
        :disabled='!reserveUsername || !reserveAmount || reserveOverLimit',
        @click='onSaveReserve'
      ) {{ $t('common.action.save') }}

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
      //- Предел месяца — строка резерва получателя: отказ контракта виден до отправки.
      p.economy__get-funds-total(v-if='reserveEnabled && myReserve', :class='{ "economy__get-funds-total--over": aidOverReserve }')
        | {{ $t('marketplace.operatorBranchEconomyPage.aidReserveRemainingLabel', { remaining: myReserveRemaining.toFixed(2), symbol: reserveSymbol }) }}
        template(v-if='aidOverReserve')
          |  {{ $t('marketplace.operatorBranchEconomyPage.aidOverReserveError') }}
      p.economy__get-funds-total.economy__get-funds-total--over(v-else-if='aidNoReserve')
        | {{ $t('marketplace.operatorBranchEconomyPage.aidNoReserveError') }}
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
        :disabled='getFundsTotal <= 0 || getFundsOverBalance || aidNoReserve || aidOverReserve',
        @click='onGetFunds'
      ) {{ $t('marketplace.operatorBranchEconomyPage.receiveAction') }}

  //- Карточка предложения строки оборота — та же, что на складе ПВЗ, без полной страницы.
  OfferRegistryOverlay(:coopname='coopname', :show-full-page='false')
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

  &__section-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--p-3, 12px);

    .economy__section-title {
      flex: 1 1 auto;
    }
  }

  &__section-meta {
    color: var(--p-ink-3);
    font-size: var(--p-fs-body-sm, 13px);
  }

  &__current-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 0 var(--p-6, 24px);
  }

  &__current-col {
    display: flex;
    flex-direction: column;
  }

  &__drawer-amount {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
    padding-bottom: var(--p-4, 16px);
    border-bottom: 1px solid var(--p-line);
  }

  &__drawer-sum {
    font-size: var(--p-fs-h2, 18px);
    font-weight: 700;
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
  }

  &__drawer-group {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
    padding: var(--p-4, 16px) 0;
    border-bottom: 1px solid var(--p-line);

    &:last-of-type {
      border-bottom: 0;
    }
  }

  &__drawer-badge {
    align-self: flex-start;
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
