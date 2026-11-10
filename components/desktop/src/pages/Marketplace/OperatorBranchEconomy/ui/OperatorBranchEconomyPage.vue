<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { uiLocale, t as i18nT } from 'src/shared/i18n';
import { useConfirm, useFirstLoad, useTabQuery } from 'src/shared/lib/composables'
import { useRoute } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useSessionStore } from 'src/entities/Session'
import { OperatorBranchBar, branchPersonName, branchPersonNames, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { DigitalDocument } from 'src/shared/lib/document'
import { BaseBadge, BaseButton, BaseDialog, BaseInput, BaseSelect, BaseTable, EmptyState } from 'src/shared/ui/base'
import type { BaseBadgeVariant, BaseTableColumn } from 'src/shared/ui/base'
import { AmountInput, DataRow, DetailsDrawer, PageHint, VerticalStepper, WalletCard } from 'src/shared/ui/domain'
import { getBranchInvestment, type MarketplaceBranchInvestmentView } from 'src/entities/MarketplaceInvestment'
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper/VerticalStepper.types'
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
import { getOperationMeta, getWalletHumanName, operationLabel, formatProcessAmount } from 'src/shared/lib/ledger2'
import { NDFL_RATE_PERCENT, type MarketplaceMessageKey, marketLiveTables, ndflNet, ndflTax } from 'src/shared/lib/marketplace'
import { Ledger2Contract } from 'cooptypes'
import { liveTable, useLiveReload } from 'src/shared/lib/realtime'
import { paymentStatusLabel, paymentStatusVariant } from 'src/shared/lib/payment'
import {
  type ExpensePlanView,
  type MarketplaceAidView,
  type MarketplaceBranchCurrentPeriodView,
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
  getBranchReserves,
  getBranchMovementParts,
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
 *     инициатору, пайщикам обратно, дефицит и коэффициент экономического участия; текущий месяц
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
/** Средства инициаторов участка: внесено, израсходовано, выделено, свободно (99D-28). */
const investView = ref<MarketplaceBranchInvestmentView | null>(null)
const aids = ref<MarketplaceAidView[]>([])
const walletHistory = ref<MarketplaceBranchWalletHistoryView['items']>([])
const personalWalletHistory = ref<MarketplacePersonalWalletHistoryView['items']>([])
const reserves = ref<MarketplaceBranchReservesView | null>(null)
const periods = ref<MarketplaceBranchPeriodRow[]>([])
const currentPeriod = ref<MarketplaceBranchCurrentPeriodView | null>(null)
/** Паевые взносы инициаторов участка (99D-31): средства инициаторов и возмещение. */

// ─── Табы страницы (requirement — переверстка без изменения логики) ───

// Раздел страницы — в адресе (?tab=): ссылка открывает тот же раздел.
const TAB_KEYS = ['wallet', 'turnover', 'expenses', 'reserve', 'distribution', 'personal', 'periods'] as const
const activeKey = useTabQuery<(typeof TAB_KEYS)[number]>(TAB_KEYS, 'wallet')

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
// ─── Панель движения по общему кошельку участка ───
// Любая строка «Движений по кошельку» открывает правую панель (слово владельца
// 09.11.2026: «изъятие на распределение — какое распределение, куда пошло?»):
// сумма и направление, путь денег — с какого кошелька на какой, смысл
// операции, у распределения — кто из доверенных сколько получил, у взноса по
// заказу — кнопка «Открыть заказ».

const BRANCH_COMMON_WALLET = 'w.brn.common'
const DISTRIBUTION_RELEASE = 'o.brn.release'
const DISTRIBUTION_PERSONAL = 'o.brn.person'

/** Код операции → ключ пояснения «что это» в словаре. */
const MOVEMENT_DESCRIPTION_KEYS: Record<string, string> = {
  'o.brn.common': 'common',
  'o.brn.retfee': 'retfee',
  'o.brn.release': 'release',
  'o.brn.expfnd': 'expfnd',
  'o.brn.expunf': 'expunf',
  'o.mkt.rpsurp': 'rpsurp',
}

type MovementPart = Awaited<ReturnType<typeof getBranchMovementParts>>[number]

const movementDrawerOpen = ref(false)
const selectedMovement = ref<WalletHistoryRow | null>(null)
const movementParts = ref<MovementPart[]>([])
const movementPartsLoading = ref(false)

const movementMeta = computed(() => (selectedMovement.value ? getOperationMeta(selectedMovement.value.operation_code) : undefined))
/** Поступление на общий кошелёк участка — иначе списание с него. */
const movementIncoming = computed(() => movementMeta.value?.wallet_to === BRANCH_COMMON_WALLET)
const movementDescription = computed(() => {
  const key = selectedMovement.value ? MOVEMENT_DESCRIPTION_KEYS[selectedMovement.value.operation_code] : undefined
  return key ? i18nT(`marketplace.operatorBranchEconomyPage.movementDescription.${key}` as MarketplaceMessageKey) : ''
})
const isDistribution = computed(() => selectedMovement.value?.operation_code === DISTRIBUTION_RELEASE)
const movementRecipients = computed(() => movementParts.value.filter((p) => p.operation_code === DISTRIBUTION_PERSONAL))
const movementRecipientsTotal = computed(() =>
  movementRecipients.value.reduce((sum, p) => sum + assetAmount(p.quantity ?? ''), 0),
)
/** Доля, которой соответствует открытая строка изъятия: зачисление сразу за ней в той же транзакции. */
const movementOwnShare = computed(() => {
  const row = selectedMovement.value
  if (!row || !isDistribution.value) return null
  const after = movementRecipients.value.filter((p) => BigInt(p.global_sequence) > BigInt(row.global_sequence))
  return after.length ? after[0].global_sequence : null
})

function walletTitle(name: string | null | undefined): string {
  if (!name) return '—'
  return getWalletHumanName(name) ?? name
}

function recipientLabel(username: string | null | undefined): string {
  if (!username) return '—'
  return nameByUsername.value[username] || username
}

async function openMovement(row: WalletHistoryRow): Promise<void> {
  selectedMovement.value = row
  movementParts.value = []
  movementDrawerOpen.value = true
  if (row.operation_code !== DISTRIBUTION_RELEASE || !row.order_hash || !braname.value) return
  movementPartsLoading.value = true
  try {
    movementParts.value = await getBranchMovementParts({ braname: braname.value, process_hash: row.order_hash })
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorBranchEconomyPage.movementPartsFailed'))
  } finally {
    movementPartsLoading.value = false
  }
}

function openMovementOrder(): void {
  const orderId = selectedMovement.value?.order_id
  if (!orderId) return
  movementDrawerOpen.value = false
  goToOrder(orderId)
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
  // Выплаченное заявление контракт стирает; строку отдаёт зеркало узла.
  if (aid.stage === Zeus.MarketplaceAidStage.PAID) return i18nT('marketplace.operatorBranchEconomyPage.statusAidPaid')
  return paymentStatusLabel(aid.payment_status)
}

function aidStageVariant(aid: MarketplaceAidView): BaseBadgeVariant {
  if (aid.stage === Zeus.MarketplaceAidStage.ON_COUNCIL) return 'info'
  if (aid.stage === Zeus.MarketplaceAidStage.PAID) return 'pos'
  return paymentStatusVariant(aid.payment_status)
}


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

/**
 * Шаги заявления: подача → решение совета → выплата кассиром → деньги
 * получены. Пройденные шаги несут дату, текущий выделен, следующие видны
 * заранее — заявитель понимает, что будет дальше. Платёж кассиру создаёт
 * решение совета, отдельного шага «передан кассиру» нет.
 */
const aidSteps = computed(() => {
  const a = selectedAid.value
  const at = (d: unknown) => (d ? formatDateToLocalTimezone(d as string, 'DD.MM.YYYY HH:mm') : undefined)
  const items: StepperStep[] = [
    { key: 'submitted', label: i18nT('marketplace.operatorBranchEconomyPage.aidStepSubmitted'), description: at(a?.submitted_at) },
    { key: 'council', label: i18nT('marketplace.operatorBranchEconomyPage.aidStepCouncil'), description: at(a?.decided_at) },
    { key: 'cashier', label: i18nT('marketplace.operatorBranchEconomyPage.aidStepCashier'), description: a?.payment_failed_at ? i18nT('marketplace.operatorBranchEconomyPage.aidStepFailed') : undefined },
    { key: 'paid', label: i18nT('marketplace.operatorBranchEconomyPage.aidStepPaid'), description: at(a?.payment_completed_at) },
  ]
  if (a?.payment_completed_at || a?.stage === Zeus.MarketplaceAidStage.PAID) return { items, active: 'paid', completed: ['submitted', 'council', 'cashier', 'paid'], errored: [] as string[] }
  if (a?.payment_failed_at) return { items, active: 'cashier', completed: ['submitted', 'council'], errored: ['cashier'] }
  if (a?.stage === Zeus.MarketplaceAidStage.ON_COUNCIL) return { items, active: 'council', completed: ['submitted'], errored: [] as string[] }
  return { items, active: 'cashier', completed: ['submitted', 'council'], errored: [] as string[] }
})

const personName = branchPersonName
const nameByUsername = computed<Record<string, string>>(() => branchPersonNames(branch.value))

/** Сколько итогов месяцев показываем: год прогонов. */
const PERIODS_LIMIT = 12

async function loadAll(): Promise<void> {
  if (!braname.value) return
  loading.value = true
  try {
    const [branchEconomy, branchPlans, personal, myAids, history, personalHistory, branchReserves, branchPeriods, current] = await Promise.all([
      getBranchEconomy(braname.value),
      listExpensePlans(braname.value),
      getPersonalEconomy(),
      listAids(),
      getBranchWalletHistory(braname.value, { page: 1, limit: 20, sortOrder: 'DESC' }),
      getPersonalWalletHistory({ page: 1, limit: 20, sortOrder: 'DESC' }),
      getBranchReserves(braname.value),
      listBranchPeriods(braname.value, { page: 1, limit: PERIODS_LIMIT, sortOrder: 'DESC' }),
      getBranchCurrentPeriod(braname.value),
    ])
    // Средства инициаторов — отдельным запросом: без договора участия у
    // участка их нет, и экономика участка показывается без этих сведений.
    investView.value = await getBranchInvestment(braname.value).catch(() => null)
    economy.value = branchEconomy
    plans.value = branchPlans
    personalBalance.value = personal.personal_balance
    aids.value = myAids
    walletHistory.value = history.items
    personalWalletHistory.value = personalHistory.items
    reserves.value = branchReserves
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
    { code: 'marketplace', table: 'invbranches' },
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

/**
 * Сумма карточкой кошелька — канон столов Стола заказов (как «Оборот»):
 * значок, заголовок, короткая подпись в одну строку, подробности — в
 * подсказке у заголовка, сумма справа с подписью.
 */
interface SumCard {
  key: string
  icon: string
  title: string
  subtitle: string
  hint?: string
  balance: string
  symbol: string
  label: string
}

/** Сумма карточки: до копеек и символ актива. */
function cardMoney(asset: string | null | undefined): Pick<SumCard, 'balance' | 'symbol'> {
  return { balance: assetAmount(asset ?? '').toFixed(2), symbol: assetSymbol(asset ?? '') }
}

/**
 * Кошелёк участка четырьмя карточками: что лежит, что держит резерв плановых
 * расходов, сколько можно распределить и сколько участок уже распределил за
 * текущий месяц. Те же карточки стоят на вкладке распределения — сумма к
 * распределению под рукой у кнопки.
 */
const walletCards = computed<SumCard[]>(() => {
  const e = economy.value
  return [
    { key: 'common', icon: 'storefront', title: i18nT('marketplace.operatorBranchEconomyPage.commonWalletTitle'),
      subtitle: i18nT('marketplace.operatorBranchEconomyPage.commonWalletSubtitle'), ...cardMoney(e?.common_balance), label: '' },
    { key: 'reserve', icon: 'lock_clock', title: i18nT('marketplace.operatorBranchEconomyPage.reserveTitle'),
      subtitle: i18nT('marketplace.operatorBranchEconomyPage.reserveSubtitle'), ...cardMoney(e?.reserve_amount), label: '' },
    { key: 'available', icon: 'call_split', title: i18nT('marketplace.operatorBranchEconomyPage.availableToDistributeTitle'),
      subtitle: i18nT('marketplace.operatorBranchEconomyPage.availableToDistributeSubtitle'), ...cardMoney(e?.available_to_distribute), label: '' },
    // Месяц — тот же, что в «Итогах месяцев»: с начала текущего месяца участка.
    { key: 'distributed', icon: 'groups', title: i18nT('marketplace.operatorBranchEconomyPage.distributedMonthTitle'),
      subtitle: i18nT('marketplace.operatorBranchEconomyPage.distributedMonthSubtitle'), ...cardMoney(currentPeriod.value?.distributed), label: '' },
  ]
})

/**
 * Текущий месяц карточками: расходы месяца, выданные заказы, их обеспечительная
 * часть, ожидаемый итог (недостача или сумма сверх расходов) и средства
 * инициаторов участка. Итог считается по тем же правилам, что прогон, но
 * ставок у идущего месяца нет — это ожидание, а не расчёт.
 */
const currentCards = computed<SumCard[]>(() => {
  const c = currentPeriod.value
  if (!c) return []
  const fmt = (a: string) => formatAsset2Digits(a)
  const symbol = assetSymbol(c.expenses)
  const month = i18nT('marketplace.operatorBranchEconomyPage.currentCardMonth')
  const gap = assetAmount(c.ripening_secured) - assetAmount(c.expenses)
  const cards: SumCard[] = [
    { key: 'expenses', icon: 'receipt_long', title: i18nT('marketplace.operatorBranchEconomyPage.currentExpensesTile'),
      subtitle: i18nT('marketplace.operatorBranchEconomyPage.currentExpensesShort'),
      hint: i18nT('marketplace.operatorBranchEconomyPage.currentExpensesSub', { planned: fmt(c.planned), memos: fmt(c.memos), reserve: fmt(c.aid_reserve), aid: fmt(c.aid_paid) }),
      ...cardMoney(c.expenses), label: month },
    { key: 'turnover', icon: 'shopping_bag', title: i18nT('marketplace.operatorBranchEconomyPage.currentTurnoverTile'),
      subtitle: i18nT('marketplace.operatorBranchEconomyPage.currentTurnoverShort'),
      hint: i18nT('marketplace.operatorBranchEconomyPage.currentTurnoverSub', { n: String(c.ripening_orders) }),
      ...cardMoney(c.ripening_turnover), label: month },
    { key: 'secured', icon: 'shield', title: i18nT('marketplace.operatorBranchEconomyPage.currentSecuredTile'),
      subtitle: i18nT('marketplace.operatorBranchEconomyPage.currentSecuredSub'),
      ...cardMoney(c.ripening_secured), label: month },
    { key: 'outcome', icon: gap < 0 ? 'trending_down' : 'trending_up',
      title: i18nT(gap < 0 ? 'marketplace.operatorBranchEconomyPage.currentDeficitTile' : 'marketplace.operatorBranchEconomyPage.currentSurplusTile'),
      subtitle: i18nT(gap < 0 ? 'marketplace.operatorBranchEconomyPage.currentDeficitShort' : 'marketplace.operatorBranchEconomyPage.currentSurplusShort'),
      balance: Math.abs(gap).toFixed(2), symbol, label: i18nT('marketplace.operatorBranchEconomyPage.currentCardExpected') },
  ]
  // Средства инициаторов — двумя карточками, по числу в каждой: сколько
  // свободно и сколько участок из них израсходовал. Карточек не больше шести.
  const v = investView.value
  if (v && (assetAmount(v.money_in_total) > 0 || assetAmount(v.property_total) > 0)) {
    cards.push({ key: 'initiators-free', icon: 'volunteer_activism', title: i18nT('marketplace.operatorBranchEconomyPage.currentInitiatorsTile'),
      subtitle: i18nT('marketplace.operatorBranchEconomyPage.currentInitiatorsShort'),
      hint: i18nT('marketplace.operatorBranchEconomyPage.currentInitiatorsSub', { reserved: fmt(v.reserved) }),
      balance: initiatorFree.value.toFixed(2), symbol, label: '' })
    cards.push({ key: 'initiators-spent', icon: 'receipt', title: i18nT('marketplace.operatorBranchEconomyPage.currentInitiatorsSpentTile'),
      subtitle: i18nT('marketplace.operatorBranchEconomyPage.currentInitiatorsSpentShort'),
      ...cardMoney(v.spent_total), label: i18nT('marketplace.operatorBranchEconomyPage.cardTotal') })
  }
  return cards
})

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

// ─── Итоги месяцев участка ───

/**
 * Подпись месяца по его границам от сервера: календарный месяц — «ноябрь
 * 2026», месяц стенда со сжатым временем (короче суток) — «08.11.2026
 * 19:20–19:30». Номер месяца на стенде — номер отрезка, годом он не читается.
 */
function monthLabel(p: { starts_at: unknown; ends_at: unknown }): string {
  const start = new Date(String(p.starts_at))
  const end = new Date(String(p.ends_at))
  if (end.getTime() - start.getTime() < 24 * 60 * 60 * 1000) {
    const day = start.toLocaleDateString(uiLocale())
    const time = (d: Date) => d.toLocaleTimeString(uiLocale(), { hour: '2-digit', minute: '2-digit' })
    return `${day} ${time(start)}–${time(end)}`
  }
  const label = start.toLocaleDateString(uiLocale(), { month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '')
  return label[0].toUpperCase() + label.slice(1)
}

const periodColumns: BaseTableColumn<MarketplaceBranchPeriodRow>[] = [
  { key: 'month', label: i18nT('marketplace.operatorBranchEconomyPage.periodColumnMonth'), width: '210px', nowrap: true },
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

/** Фаза участка по паевым взносам в месяце: бейдж в итогах месяцев. */
const PERIOD_PHASE: Record<Zeus.MarketplacePeriodInvestPhase, { label: MarketplaceMessageKey; variant: BaseBadgeVariant } | null> = {
  [Zeus.MarketplacePeriodInvestPhase.NONE]: null,
  [Zeus.MarketplacePeriodInvestPhase.DEFICIT]: { label: 'marketplace.operatorBranchEconomyPage.periodPhaseDeficit', variant: 'warn' },
  [Zeus.MarketplacePeriodInvestPhase.REPAYING]: { label: 'marketplace.operatorBranchEconomyPage.periodPhaseRepaying', variant: 'info' },
  [Zeus.MarketplacePeriodInvestPhase.BRANCH]: { label: 'marketplace.operatorBranchEconomyPage.periodPhaseBranch', variant: 'pos' },
}

const selectedPeriod = ref<MarketplaceBranchPeriodRow | null>(null)

/**
 * Путь денег месяца — связной цепочкой по строке итога: собранная
 * обеспечительная часть → расходы участка → доля участка и недостача → фонды
 * → инициаторы (возмещение или участку) → пайщикам обратно. Те же числа, что
 * ниже группами, но по порядку, в котором их делит контракт (closeperiod).
 */
const periodFlow = computed<StepperStep[]>(() => {
  const p = selectedPeriod.value
  if (!p) return []
  const fmt = (a: string) => formatAsset2Digits(a)
  const deficit = assetAmount(p.deficit) > 0
  const steps: StepperStep[] = [
    { key: 'secured', label: i18nT('marketplace.operatorBranchEconomyPage.flowSecured', { amount: fmt(p.secured) }), description: i18nT('marketplace.operatorBranchEconomyPage.flowSecuredSub', { turnover: fmt(p.turnover) }) },
    { key: 'expenses', label: i18nT('marketplace.operatorBranchEconomyPage.flowExpenses', { amount: fmt(p.expenses) }),
      description: i18nT('marketplace.operatorBranchEconomyPage.flowExpensesSub', { planned: fmt(p.planned), memos: fmt(p.memos), reserve: fmt(p.aid_reserve), unpaid: fmt(p.aid_unpaid) }) },
    { key: 'branch', label: i18nT('marketplace.operatorBranchEconomyPage.flowBranch', { amount: fmt(p.branch_amount) }),
      description: deficit ? i18nT('marketplace.operatorBranchEconomyPage.flowBranchDeficitSub', { deficit: fmt(p.deficit) }) : i18nT('marketplace.operatorBranchEconomyPage.flowBranchCoveredSub') },
  ]
  if (deficit) {
    steps.push({ key: 'rest', label: i18nT('marketplace.operatorBranchEconomyPage.flowRestZero'), description: i18nT('marketplace.operatorBranchEconomyPage.flowRestZeroSub') })
    return steps
  }
  steps.push({ key: 'funds', label: i18nT('marketplace.operatorBranchEconomyPage.flowFunds', { amount: fmt(p.funds_amount) }), description: i18nT('marketplace.operatorBranchEconomyPage.flowFundsSub') })
  const repaying = p.invest_phase === Zeus.MarketplacePeriodInvestPhase.REPAYING
  steps.push({ key: 'initiators', label: repaying ? i18nT('marketplace.operatorBranchEconomyPage.flowInitiatorsRepaid', { amount: fmt(p.investor_repaid) }) : i18nT('marketplace.operatorBranchEconomyPage.flowInitiators', { amount: fmt(p.initiator_amount) }),
    description: repaying ? i18nT('marketplace.operatorBranchEconomyPage.flowInitiatorsRepaidSub') : i18nT('marketplace.operatorBranchEconomyPage.flowInitiatorsSub') })
  steps.push({ key: 'returned', label: i18nT('marketplace.operatorBranchEconomyPage.flowReturned', { amount: fmt(p.return_amount) }), description: i18nT('marketplace.operatorBranchEconomyPage.flowReturnedSub') })
  return steps
})
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

/**
 * Свободные средства инициаторов участка: неиспользованные деньги минус
 * выделенные под расходы и помощь (`MarketInvest::free_of`). Контракт берёт
 * помощь из этих средств, когда персонального кошелька не хватает (createaid, 99D-28).
 */
const initiatorFree = computed(() => {
  const v = investView.value
  if (!v) return 0
  const free = assetAmount(v.unused_total) - assetAmount(v.reserved)
  return free > 0 ? free : 0
})

/** Источник помощи — как выберет контракт: персональный кошелёк, затем средства инициаторов. */
const aidSource = computed<'personal' | 'initiators' | null>(() => {
  const amount = getFundsTotal.value
  if (amount <= 0) return null
  if (amount <= assetAmount(personalBalance.value)) return 'personal'
  if (amount <= initiatorFree.value) return 'initiators'
  return null
})

/**
 * Больше всего можно попросить одним заявлением: источник один, поэтому
 * предел — больший из двух, а при заданном резерве — не больше его остатка.
 */
const aidMax = computed(() => {
  const bySource = Math.max(assetAmount(personalBalance.value), initiatorFree.value)
  return reserveEnabled.value && myReserve.value ? Math.min(bySource, myReserveRemaining.value) : bySource
})

const getFundsOverBalance = computed(() => getFundsTotal.value > 0 && aidSource.value === null)

// Предел материальной помощи за месяц — строка резерва получателя. Контракт
// держит то же правило (BRANCH_AID_OVER_RESERVE); здесь отказ виден до отправки.
const aidNoReserve = computed(() => reserveEnabled.value && !myReserve.value)
const aidOverReserve = computed(() => reserveEnabled.value && !!myReserve.value && getFundsTotal.value > myReserveRemaining.value)

/** Почему заявление не будет отправлено в цепь — одной строкой под полем суммы. */
const aidError = computed(() => {
  if (aidNoReserve.value) return i18nT('marketplace.operatorBranchEconomyPage.aidNoReserveError')
  if (aidOverReserve.value) return i18nT('marketplace.operatorBranchEconomyPage.aidOverReserveError')
  if (getFundsOverBalance.value)
    return i18nT('marketplace.operatorBranchEconomyPage.aidOverSourceError', { max: aidMax.value.toFixed(2), symbol: assetSymbol(personalBalance.value) })
  return ''
})

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
      .wallet-grid
        WalletCard(
          v-for='c in walletCards',
          :key='c.key',
          program='wallet',
          :icon='c.icon',
          :title='c.title',
          :subtitle='c.subtitle',
          :balance='c.balance',
          :symbol='c.symbol',
          :balance-label='c.label',
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
          clickable-rows,
          @row-click='openMovement'
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
      .wallet-grid
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
      //- Сумма к распределению — под рукой у кнопки «Распределить»: тот же
      //- ряд, что на вкладке кошелька участка.
      .wallet-grid
        WalletCard(
          v-for='c in walletCards',
          :key='c.key',
          program='wallet',
          :icon='c.icon',
          :title='c.title',
          :subtitle='c.subtitle',
          :balance='c.balance',
          :symbol='c.symbol',
          :balance-label='c.label',
          :loading='loading && !economy'
        )
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
        .wallet-grid
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
      .wallet-grid
        WalletCard(
          program='wallet',
          :title='$t("marketplace.operatorBranchEconomyPage.myFreeFundsTitle")',
          :subtitle='$t("marketplace.operatorBranchEconomyPage.myFreeFundsSubtitle")',
          :balance='assetAmount(personalBalance).toFixed(2)',
          :symbol='assetSymbol(personalBalance)',
          :loading='loading && !personalBalance'
        )
        //- Получено распределением участка с начала текущего месяца участка.
        WalletCard(
          program='wallet',
          icon='south_west',
          :title='$t("marketplace.operatorBranchEconomyPage.receivedMonthTitle")',
          :subtitle='$t("marketplace.operatorBranchEconomyPage.receivedMonthSubtitle")',
          :balance='assetAmount(currentPeriod?.received ?? "").toFixed(2)',
          :symbol='assetSymbol(currentPeriod?.received ?? "")',
          :loading='loading && !currentPeriod'
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
      //- Текущий месяц: подпись, даты месяца и пояснение, ниже — ряд плиток
      //- по канону: расходы месяца, выданные заказы, их обеспечительная часть,
      //- ожидаемый итог и средства инициаторов участка.
      template(v-if='currentPeriod')
        //- Шапка — как у «Топа позиций по обороту»: название раздела с
        //- подсказкой, справа даты месяца; пояснение — в подсказке.
        .economy__current-head
          .economy__current-title
            .t-h3 {{ $t('marketplace.operatorBranchEconomyPage.currentPeriodEyebrow') }}
            q-icon.economy__current-hint(name='help_outline', size='18px')
              q-tooltip(max-width='360px') {{ $t('marketplace.operatorBranchEconomyPage.currentPeriodSubtitle') }}
          .economy__current-dates.t-muted {{ monthLabel(currentPeriod) }}
        .wallet-grid
          WalletCard(
            v-for='c in currentCards',
            :key='c.key',
            program='wallet',
            :icon='c.icon',
            :title='c.title',
            :subtitle='c.subtitle',
            :hint='c.hint',
            :balance='c.balance',
            :symbol='c.symbol',
            :balance-label='c.label'
          )

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
          //- Месяц — одной строкой; недостача — своей колонкой, фаза паевых
          //- взносов — в панели месяца: строки таблицы одной высоты.
          .economy__name {{ monthLabel(p) }}
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

  //- Движение по общему кошельку участка: сумма и направление, путь денег
  //- (с какого кошелька на какой), что это за операция, у распределения —
  //- получатели долей, у взноса по заказу — кнопка «Открыть заказ» внизу.
  DetailsDrawer(
    v-model='movementDrawerOpen',
    :title='selectedMovement ? operationLabel({ operationCode: selectedMovement.operation_code, action: "apply" }) : ""',
    :width='520'
  )
    template(v-if='selectedMovement')
      .economy__drawer-amount
        .t-muted {{ movementIncoming ? $t('marketplace.operatorBranchEconomyPage.movementIncoming') : $t('marketplace.operatorBranchEconomyPage.movementOutgoing') }}
        .economy__drawer-sum {{ movementIncoming ? '+' : '−' }} {{ formatAsset2Digits(selectedMovement.quantity ?? '') }}
        .t-muted {{ formatDateToLocalTimezone(selectedMovement.created_at, 'DD.MM.YYYY HH:mm') }}
      .economy__drawer-group
        .economy__section-title {{ $t('marketplace.operatorBranchEconomyPage.movementPathTitle') }}
        DataRow(:label='$t("marketplace.operatorBranchEconomyPage.movementFrom")', :value='walletTitle(movementMeta?.wallet_from)')
        DataRow(:label='$t("marketplace.operatorBranchEconomyPage.movementTo")', :value='walletTitle(movementMeta?.wallet_to)')
      .economy__drawer-group(v-if='movementDescription')
        .economy__section-title {{ $t('marketplace.operatorBranchEconomyPage.movementWhatTitle') }}
        p.economy__drawer-text {{ movementDescription }}
      .economy__drawer-group(v-if='isDistribution')
        .economy__section-title {{ $t('marketplace.operatorBranchEconomyPage.movementRecipientsTitle') }}
        template(v-if='movementPartsLoading')
          q-skeleton(v-for='n in 3', :key='n', type='text')
        template(v-else-if='movementRecipients.length')
          DataRow(
            v-for='p in movementRecipients',
            :key='p.global_sequence',
            align='spread',
            :label='recipientLabel(p.username)',
            :value='formatAsset2Digits(p.quantity ?? "")',
            :hint='p.global_sequence === movementOwnShare ? $t("marketplace.operatorBranchEconomyPage.movementOwnShareHint") : undefined',
            mono
          )
          DataRow(
            align='spread',
            :label='$t("marketplace.operatorBranchEconomyPage.movementRecipientsTotal")',
            :value='formatAsset2Digits(`${movementRecipientsTotal.toFixed(4)} ${assetSymbol(selectedMovement.quantity ?? "")}`)',
            mono
          )
        .t-muted(v-else) {{ $t('marketplace.operatorBranchEconomyPage.movementRecipientsEmpty') }}
      .economy__drawer-group(v-if='selectedMovement.memo')
        DataRow(:label='$t("marketplace.operatorBranchEconomyPage.columnPurpose")', :value='selectedMovement.memo')
    template(v-if='selectedMovement?.order_id', #footer)
      BaseButton(variant='secondary', @click='openMovementOrder') {{ $t('marketplace.operatorBranchEconomyPage.movementOpenOrder') }}

  //- Состав итога месяца — правая панель: путь денег, факты прогона и расчёт
  //- контракта. Компенсацию получают все инициаторы участка пропорционально —
  //- одного получателя у неё нет.
  DetailsDrawer(v-model='periodDrawerOpen', :title='selectedPeriod ? monthLabel(selectedPeriod) : ""')
    template(v-if='selectedPeriod')
      .economy__drawer-amount
        .t-muted {{ $t('marketplace.operatorBranchEconomyPage.periodMembership') }}
        .economy__drawer-sum {{ formatAsset2Digits(selectedPeriod.membership) }}
        .t-muted {{ $t('marketplace.operatorBranchEconomyPage.periodRateLine', { rate: ratePercentLabel(selectedPeriod.rate_percent) }) }}
      //- Путь денег месяца: шаги в том порядке, в котором итог делит собранное.
      .economy__drawer-group
        .economy__section-title {{ $t('marketplace.operatorBranchEconomyPage.flowTitle') }}
        VerticalStepper(:steps='periodFlow', :active-key='periodFlow.length ? periodFlow[periodFlow.length - 1].key : ""', :completed='periodFlow.map((s) => s.key)')
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
        DataRow(
          v-if='PERIOD_PHASE[selectedPeriod.invest_phase]',
          align='spread',
          :label='$t("marketplace.operatorBranchEconomyPage.periodInvestorRepaid")',
          :value='formatAsset2Digits(selectedPeriod.investor_repaid)',
          :hint='selectedPeriod.invest_phase === Zeus.MarketplacePeriodInvestPhase.REPAYING ? $t("marketplace.operatorBranchEconomyPage.periodInitiatorRepayHint") : $t("marketplace.operatorBranchEconomyPage.periodInitiatorBranchHint")',
          mono
        )
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodColumnReturned")', :value='formatAsset2Digits(selectedPeriod.return_amount)', mono)
        DataRow(align='spread', :label='$t("marketplace.operatorBranchEconomyPage.periodColumnDeficit")', :value='formatAsset2Digits(selectedPeriod.deficit)', mono)
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
      //- Ход заявления по шагам — что прошло (с датой) и что будет дальше.
      //- Документов процесса в панели нет (решение владельца 05.11.2026): свои
      //- документы пайщик видит в разделе «Документы», где отбор по владельцу.
      .economy__drawer-group
        .economy__section-title {{ $t('marketplace.operatorBranchEconomyPage.aidTimelineTitle') }}
        VerticalStepper(:steps='aidSteps.items', :active-key='aidSteps.active', :completed='aidSteps.completed', :errored='aidSteps.errored')

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
      //- Одна подсказка: как выплачивается помощь и почему на счёт придёт меньше.
      .banner.banner--info
        q-icon.banner__icon(name='info', size='18px')
        .banner__body
          | {{ $t('marketplace.operatorBranchEconomyPage.aidHintIntro') }}
          | {{ $t('marketplace.operatorBranchEconomyPage.aidHintApproval') }}
          | {{ $t('marketplace.operatorBranchEconomyPage.aidHintTax') }}
          | {{ $t('marketplace.operatorBranchEconomyPage.aidHintTaxTail') }}
      //- Откуда возьмётся помощь: персональный кошелёк, при нехватке — средства
      //- инициаторов участка; предел месяца — остаток резерва получателя.
      .economy__aid-sources
        DataRow(align='spread', mono, :label='$t("marketplace.operatorBranchEconomyPage.aidSourcePersonalTile")', :value='`${assetAmount(personalBalance).toFixed(2)} ${assetSymbol(personalBalance)}`')
        DataRow(v-if='investView', align='spread', mono, :label='$t("marketplace.operatorBranchEconomyPage.aidSourceInitiatorsTile")', :value='`${initiatorFree.toFixed(2)} ${assetSymbol(personalBalance)}`', :hint='$t("marketplace.operatorBranchEconomyPage.aidSourceInitiatorsSub")')
        DataRow(v-if='reserveEnabled && myReserve', align='spread', mono, :label='$t("marketplace.operatorBranchEconomyPage.aidReserveTile")', :value='`${myReserveRemaining.toFixed(2)} ${reserveSymbol}`', :hint='$t("marketplace.operatorBranchEconomyPage.aidReserveSub")')
      AmountInput(
        v-model='aidPart',
        :label='$t("marketplace.operatorBranchEconomyPage.aidAmountLabel")',
        :symbol='assetSymbol(personalBalance)',
        :precision='2',
        :min='0',
        show-max,
        show-balance,
        :balance='aidMax'
      )
      template(v-if='Number(aidPart) > 0')
        //- Разбивка удержания: человек вписал одну сумму, а на счёт придёт
        //- меньше — без этих строк разница читается как ошибка выплаты.
        .economy__aid-breakdown
          DataRow(align='spread', mono, :label='$t("marketplace.operatorBranchEconomyPage.accruedLabel")', :value='`${aidGross.toFixed(2)} ${assetSymbol(personalBalance)}`')
          DataRow(align='spread', mono, :label='$t("marketplace.operatorBranchEconomyPage.taxWithheldLabel", { percent: NDFL_RATE_PERCENT })', :value='`−${aidTax.toFixed(2)} ${assetSymbol(personalBalance)}`')
          .economy__aid-total
            DataRow(align='spread', mono, :label='$t("marketplace.operatorBranchEconomyPage.toTransferLabel")', :value='`${aidNet.toFixed(2)} ${assetSymbol(personalBalance)}`')
          //- Без этой сноски округление читается как ошибка: с 10 ₽ тринадцать
          //- процентов — это 1,30, а удерживается ровно рубль.
          .economy__tax-note
            | {{ $t('marketplace.operatorBranchEconomyPage.taxRoundingHintIntro') }}
            | {{ $t('marketplace.operatorBranchEconomyPage.taxRoundingHintTail') }}
        DataRow(
          v-if='aidSource',
          align='spread',
          :label='$t("marketplace.operatorBranchEconomyPage.aidSourceLabel")',
          :value='aidSource === "personal" ? $t("marketplace.operatorBranchEconomyPage.aidSourcePersonal") : $t("marketplace.operatorBranchEconomyPage.aidSourceInitiators")'
        )
        PaymentMethodSelect(
          v-model='aidPaymentMethodId',
          :username='session.username',
          required
        )
        //- Заявление подписывается под капотом: подписанный документ виден в заявке.
        .economy__get-funds-note
          | {{ $t('marketplace.operatorBranchEconomyPage.autoSignHintIntro') }}
          | {{ $t('marketplace.operatorBranchEconomyPage.autoSignHintTail') }}
      //- Правило контракта видно до отправки: источник, предел месяца, резерв.
      .banner.banner--neg(v-if='aidError')
        q-icon.banner__icon(name='error', size='18px')
        .banner__body {{ aidError }}
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

  // Шапка текущего месяца — как у «Топа позиций по обороту»: название
  // раздела с подсказкой слева, даты месяца справа.
  &__current-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--p-3);
  }

  &__current-title {
    display: flex;
    align-items: center;
    gap: var(--p-2);
  }

  &__current-hint {
    color: var(--p-ink-3);
    cursor: help;
  }

  &__current-dates {
    font-size: var(--p-fs-body-sm);
    font-variant-numeric: tabular-nums;
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

  &__drawer-text {
    margin: 0;
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body, 1.5);
  }

  &__get-funds-note {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
  }

  // Источники помощи в диалоге: строки «подпись — сумма» у правого края.
  &__aid-sources {
    display: flex;
    flex-direction: column;
    gap: var(--p-1);
  }

  // Разбивка удержания налога: строки суммы на сером поле, итог отделён линией.
  &__aid-breakdown {
    display: flex;
    flex-direction: column;
    gap: var(--p-1);
    padding: var(--p-3);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm);
    background: var(--p-surface-2);
  }

  &__aid-total {
    padding-top: var(--p-1);
    border-top: 1px solid var(--p-line);
    font-weight: 600;
  }

  &__tax-note {
    margin-top: var(--p-2);
    color: var(--p-ink-3);
    font-size: var(--p-fs-meta);
    line-height: var(--p-lh-meta);
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
