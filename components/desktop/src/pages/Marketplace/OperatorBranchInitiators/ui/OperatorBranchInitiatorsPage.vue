<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'
import { t as i18nT } from 'src/shared/i18n'
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useSessionStore } from 'src/entities/Session'
import { OperatorBranchBar, branchPersonNames, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { useDocumentStore } from 'src/entities/Document/model/store'
import type { IDocumentPackageAggregate } from 'src/entities/Document/model/types'
import { DigitalDocument } from 'src/shared/lib/document'
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { liveTable, useLiveReload } from 'src/shared/lib/realtime'
import type { MarketplaceMessageKey } from 'src/shared/lib/marketplace'
import { Ledger2Contract } from 'cooptypes'
import { BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput, BaseTable, EmptyState } from 'src/shared/ui/base'
import type { BaseBadgeVariant, BaseTableColumn } from 'src/shared/ui/base'
import { AmountInput, DataRow, DetailsDrawer, DocumentSignSheet, PageHint, WalletCard } from 'src/shared/ui/domain'
import { ComplexDocument } from 'src/shared/ui/ComplexDocument'
import { PageTabs, type PageTab } from 'src/shared/ui/layout'
import { ChairmanApprovalActions } from 'src/features/ChairmanApproval'
import { refreshMenuBadges } from 'src/shared/lib/menuBadges'
import {
  type InvestDocumentView,
  type MarketplaceBranchInvestmentView,
  type MarketplaceInvestAgreementView,
  type MarketplaceInvestHistoryEntry,
  type MarketplaceInvestPropertyView,
  type MarketplaceInvestorView,
  approveProperty,
  canApproveProperty,
  canSignPropertyAct,
  propertyFactsOf,
  type InvestPropertyFacts,
  claimInvestment,
  createProperty,
  declineProperty,
  getAgreementPayload,
  getBranchInvestment,
  getClaimPayload,
  getInvestStatementPayload,
  getMyAgreement,
  getMyInvestHistory,
  getPropertyActPayload,
  getPropertyApprovalPayload,
  getPropertyStatementPayload,
  investMoney,
  listMyInvestments,
  signAgreement,
  signPropertyAct,
} from 'src/entities/MarketplaceInvestment'

/**
 * Стол ПВЗ → «Инициаторы участка» (задача 99D-31, решение владельца
 * 07.11.2026: одна страница с разделами на столе операторов участка).
 *
 * Без договора участия страница показывает только договор: подписать его —
 * первый шаг инициатора. С договором — разделы:
 *  1. «Мои взносы» — что внесено, использовано, возвращено и доступно к
 *     возврату по выбранному участку; история паевых взносов строками. Действия в
 *     строке разделов: внести деньгами, внести имуществом, получить возврат.
 *  2. «Имущество» — заявления на имущество до приёма с действием по этапу
 *     (председатель участка одобряет и подписывает акт второй подписью,
 *     вносящий подписывает акт после решения совета) и принятое имущество.
 *  3. «Инициаторы участка» — председателю участка: итоги участка и строки
 *     инициаторов.
 *
 * Суммы к возврату считает контракт: страница показывает предварительный
 * расчёт сервера и не складывает деньги сама.
 */


const route = useRoute()
const session = useSessionStore()
const store = useOperatorBranchStore()
const documents = useDocumentStore()
const { confirm } = useConfirm()

const coopname = computed(() => String(route.params.coopname ?? ''))
const braname = computed(() => store.activeBraname ?? '')
const isTrustee = computed(() => Boolean(store.activeBranch?.isTrustee))
const names = computed(() => branchPersonNames(store.activeBranch?.branch))

const loading = ref(true)
/** Скелетон — только на первой загрузке; дочитка по ленте обновляет молча. */
const firstLoad = useFirstLoad(loading)
const agreement = ref<MarketplaceInvestAgreementView | null>(null)
const myRows = ref<MarketplaceInvestorView[]>([])
const branchView = ref<MarketplaceBranchInvestmentView | null>(null)
const history = ref<MarketplaceInvestHistoryEntry[]>([])

/** Сколько записей истории показываем: последние паевые взносы и возвраты. */
const HISTORY_LIMIT = 50

const mine = computed(() => myRows.value.find((r) => r.braname === braname.value) ?? null)

// ─── Разделы страницы ───

type TabKey = 'mine' | 'property' | 'initiators'
const activeKey = ref<TabKey>('mine')

const pendingProperties = computed<MarketplaceInvestPropertyView[]>(() => {
  const rows = branchView.value?.properties ?? []
  return isTrustee.value ? rows : rows.filter((p) => p.username === session.username)
})
const acceptedProperties = computed(() => history.value.filter((h) => h.kind === Zeus.MarketplaceInvestHistoryKind.PROPERTY))

/**
 * Вкладка «Имущество» — одна таблица имущества: сверху заявления в работе,
 * ниже принятое (этап «Принято»). Принятое берётся из истории операций учёта,
 * наименование — из документов его пакета (заявление после приёма стёрто).
 */
interface PropertyListRow {
  key: string
  name: string
  investor: string
  amount: string
  date: string
  pending: MarketplaceInvestPropertyView | null
  accepted: MarketplaceInvestHistoryEntry | null
}
const propertyRows = computed<PropertyListRow[]>(() => [
  ...pendingProperties.value.map((p) => ({
    key: p.hash,
    name: propertyTitle(p),
    investor: names.value[p.username] || p.username,
    amount: p.amount,
    date: '',
    pending: p,
    accepted: null,
  })),
  ...acceptedProperties.value.map((h) => ({
    key: h.process_hash,
    name: propertyFacts.value[h.process_hash]?.name ?? i18nT('marketplace.initiatorsPage.kindProperty'),
    investor: names.value[session.username] || session.username,
    amount: h.amount,
    date: dateOf(h.created_at),
    pending: null,
    accepted: h,
  })),
])

function openPropertyRow(row: PropertyListRow): void {
  if (row.pending) openProperty(row.pending)
  else if (row.accepted) openHistory(row.accepted)
}

const tabs = computed<PageTab[]>(() => [
  { key: 'mine', label: i18nT('marketplace.initiatorsPage.mineTab') },
  { key: 'property', label: i18nT('marketplace.initiatorsPage.propertyTab'), count: pendingProperties.value.length || undefined },
  ...(isTrustee.value
    ? [{ key: 'initiators', label: i18nT('marketplace.initiatorsPage.initiatorsTab'), count: branchView.value?.investors.length || undefined }]
    : []),
])

function onSelectTab(tab: PageTab): void {
  activeKey.value = tab.key as TabKey
}

// ─── Загрузка ───

async function loadAll(): Promise<void> {
  if (!braname.value) return
  loading.value = true
  try {
    agreement.value = await getMyAgreement()
    if (!agreement.value) {
      void loadAgreementDoc()
      return
    }
    const [rows, view, page] = await Promise.all([
      listMyInvestments(),
      getBranchInvestment(braname.value),
      getMyInvestHistory({ page: 1, limit: HISTORY_LIMIT, sortOrder: 'DESC' }),
    ])
    myRows.value = rows
    branchView.value = view
    history.value = page.items
    void loadPropertyFacts(page.items)
  } catch (e) {
    FailAlert(e, i18nT('marketplace.initiatorsPage.loadFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await store.ensureLoaded(coopname.value)
  void loadAll()
})

watch(braname, () => void loadAll())

// Договоры, паевые взносы, заявления на имущество — таблицы контракта; кошелёк
// паевые взносы — ledger2; документы истории — реестр документов узла.
useLiveReload(
  [
    { code: 'marketplace', table: 'invagreemnts' },
    { code: 'marketplace', table: 'invbranches' },
    { code: 'marketplace', table: 'investors' },
    { code: 'marketplace', table: 'invprops' },
    liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets),
  ],
  loadAll,
)

// ─── Суммы и подписи ───

function amountOf(asset: string | null | undefined): number {
  return Number.parseFloat(String(asset ?? '0').split(' ')[0] ?? '0') || 0
}

function symbolOf(asset: string | null | undefined): string {
  return String(asset ?? '').split(' ')[1] ?? ''
}

const symbol = computed(() => symbolOf(mine.value?.money ?? branchView.value?.money_total))

/** Сумма двух активов строкой с символом первого — «внесено деньгами и имуществом». */
function sumAssets(a: string | undefined, b: string | undefined): string {
  return `${(amountOf(a) + amountOf(b)).toFixed(4)} ${symbolOf(a ?? b)}`
}

/** У пайщика есть паевые взносы в выбранный участок. */
const hasMine = computed(() => Boolean(mine.value && amountOf(mine.value.money) + amountOf(mine.value.property) > 0))

/**
 * Карточка суммы — та же, что у кошельков на «Экономике участка»: значок,
 * название, пояснение под ним и сумма справа с подписью. Порядок карточек —
 * путь денег: внесено → использовано участком → возмещено → доступно.
 */
interface SumCard {
  key: string
  icon: string
  title: string
  subtitle: string
  asset: string | undefined
  label: string
}

const myCards = computed<SumCard[]>(() => {
  const m = mine.value
  return [
    { key: 'invested', icon: 'savings', title: i18nT('marketplace.initiatorsPage.mineCardInvested'), asset: sumAssets(m?.money, m?.property), label: i18nT('marketplace.initiatorsPage.cardTotal'),
      subtitle: i18nT('marketplace.initiatorsPage.tileInvestedSub', { money: formatAsset2Digits(m?.money ?? ''), property: formatAsset2Digits(m?.property ?? '') }) },
    { key: 'used', icon: 'receipt_long', title: i18nT('marketplace.initiatorsPage.mineCardUsed'), asset: m?.used, label: i18nT('marketplace.initiatorsPage.cardSpent'),
      subtitle: i18nT('marketplace.initiatorsPage.tileUnusedLeft', { amount: formatAsset2Digits(m?.unused ?? '') }) },
    { key: 'returned', icon: 'trending_up', title: i18nT('marketplace.initiatorsPage.mineCardReturned'), asset: m?.returned, label: i18nT('marketplace.initiatorsPage.cardTotal'),
      subtitle: i18nT('marketplace.initiatorsPage.tileReturnedSub') },
    { key: 'claimable', icon: 'account_balance_wallet', title: i18nT('marketplace.initiatorsPage.mineCardClaimable'), asset: m?.claimable, label: i18nT('marketplace.initiatorsPage.cardNow'),
      subtitle: i18nT('marketplace.initiatorsPage.tileClaimableSub') },
  ]
})

/** У участка есть инициаторы: без них итоги — одни нули, вкладка показывает пустое состояние. */
const hasInvestors = computed(() => Boolean(branchView.value?.investors.length))

/** Итоги участка — те же четыре шага по всем инициаторам. */
const branchCards = computed<SumCard[]>(() => {
  const b = branchView.value
  return [
    { key: 'invested', icon: 'savings', title: i18nT('marketplace.initiatorsPage.tileBranchInvested'), asset: sumAssets(b?.money_total, b?.property_total), label: i18nT('marketplace.initiatorsPage.cardTotal'),
      subtitle: i18nT('marketplace.initiatorsPage.tileInvestedSub', { money: formatAsset2Digits(b?.money_total ?? ''), property: formatAsset2Digits(b?.property_total ?? '') }) },
    { key: 'spent', icon: 'receipt_long', title: i18nT('marketplace.initiatorsPage.tileBranchSpent'), asset: b?.spent_total, label: i18nT('marketplace.initiatorsPage.cardSpent'),
      subtitle: i18nT('marketplace.initiatorsPage.branchSpentSub', { reserved: formatAsset2Digits(b?.reserved ?? ''), unused: formatAsset2Digits(b?.unused_total ?? '') }) },
    { key: 'repaid', icon: 'trending_up', title: i18nT('marketplace.initiatorsPage.tileBranchRepaid'), asset: b?.repaid_total, label: i18nT('marketplace.initiatorsPage.cardTotal'),
      subtitle: i18nT('marketplace.initiatorsPage.tileBranchRepaidSub') },
    { key: 'outstanding', icon: 'hourglass_bottom', title: i18nT('marketplace.initiatorsPage.tileBranchOutstanding'), asset: b?.outstanding, label: i18nT('marketplace.initiatorsPage.cardLeft'),
      subtitle: i18nT('marketplace.initiatorsPage.tileBranchOutstandingSub') },
  ]
})

const PROPERTY_STAGE: Record<Zeus.MarketplaceInvestPropertyStatus, { label: MarketplaceMessageKey; variant: BaseBadgeVariant }> = {
  [Zeus.MarketplaceInvestPropertyStatus.CREATED]: { label: 'marketplace.initiatorsPage.stageCreated', variant: 'info' },
  [Zeus.MarketplaceInvestPropertyStatus.APPROVED]: { label: 'marketplace.initiatorsPage.stageApproved', variant: 'info' },
  [Zeus.MarketplaceInvestPropertyStatus.AUTHORIZED]: { label: 'marketplace.initiatorsPage.stageAuthorized', variant: 'warn' },
  [Zeus.MarketplaceInvestPropertyStatus.ACT1]: { label: 'marketplace.initiatorsPage.stageAct1', variant: 'warn' },
}

const HISTORY_KIND: Record<Zeus.MarketplaceInvestHistoryKind, MarketplaceMessageKey> = {
  [Zeus.MarketplaceInvestHistoryKind.MONEY]: 'marketplace.initiatorsPage.kindMoney',
  [Zeus.MarketplaceInvestHistoryKind.PROPERTY]: 'marketplace.initiatorsPage.kindProperty',
  [Zeus.MarketplaceInvestHistoryKind.CLAIM]: 'marketplace.initiatorsPage.kindClaim',
  [Zeus.MarketplaceInvestHistoryKind.EXIT]: 'marketplace.initiatorsPage.kindExit',
}

function dateOf(value: unknown): string {
  return value ? formatDateToLocalTimezone(value as string, 'DD.MM.YYYY HH:mm') : '—'
}

/** Наименование имущества — часть описания до запятой, как в заявлении. */
function propertyTitle(p: MarketplaceInvestPropertyView): string {
  return p.description.split(',')[0]?.trim() || p.description
}

// ─── Таблицы ───

const historyColumns = computed<BaseTableColumn<MarketplaceInvestHistoryEntry>[]>(() => [
  { key: 'date', label: i18nT('marketplace.initiatorsPage.columnDate'), width: '170px', nowrap: true },
  { key: 'kind', label: i18nT('marketplace.initiatorsPage.columnKind') },
  { key: 'amount', label: i18nT('marketplace.initiatorsPage.columnAmount'), width: '180px', numeric: true },
])

const propertyColumns = computed<BaseTableColumn<PropertyListRow>[]>(() => [
  { key: 'title', label: i18nT('marketplace.initiatorsPage.columnProperty') },
  { key: 'investor', label: i18nT('marketplace.initiatorsPage.columnInvestor'), width: '220px' },
  { key: 'amount', label: i18nT('marketplace.initiatorsPage.columnPrice'), width: '160px', numeric: true },
  { key: 'stage', label: i18nT('marketplace.initiatorsPage.columnStage'), width: '230px', nowrap: true },
  { key: 'actions', label: '', width: '220px', align: 'right' },
])

const investorColumns = computed<BaseTableColumn<MarketplaceInvestorView>[]>(() => [
  { key: 'investor', label: i18nT('marketplace.initiatorsPage.columnInvestor') },
  { key: 'invested', label: i18nT('marketplace.initiatorsPage.columnInvested'), width: '160px', numeric: true },
  { key: 'used', label: i18nT('marketplace.initiatorsPage.columnUsed'), width: '160px', numeric: true },
  { key: 'returned', label: i18nT('marketplace.initiatorsPage.columnReturned'), width: '160px', numeric: true },
  { key: 'status', label: i18nT('marketplace.initiatorsPage.columnStatus'), width: '180px', nowrap: true },
])

function invested(r: MarketplaceInvestorView): string {
  return `${(amountOf(r.money) + amountOf(r.property)).toFixed(2)} ${symbolOf(r.money)}`
}

// ─── Правая панель ───

const selectedHistory = ref<MarketplaceInvestHistoryEntry | null>(null)
const selectedProperty = ref<MarketplaceInvestPropertyView | null>(null)
const selectedInvestor = ref<MarketplaceInvestorView | null>(null)
const drawerPackage = ref<IDocumentPackageAggregate | null>(null)
const drawerDocLoading = ref(false)
/** Чтение документов упало — показать это прямо, а не «документ ещё не записан». */
const drawerDocFailed = ref(false)
/** Хэш процесса открытой записи — для повтора чтения. */
const drawerProcessHash = ref('')

const drawerOpen = computed({
  get: () => Boolean(selectedHistory.value || selectedProperty.value || selectedInvestor.value),
  set: (open: boolean) => {
    if (open) return
    selectedHistory.value = null
    selectedProperty.value = null
    selectedInvestor.value = null
    drawerPackage.value = null
  },
})

/** Документ процесса — из реестра документов по хэшу процесса. */
async function loadPackage(processHash: string): Promise<void> {
  drawerPackage.value = null
  drawerDocFailed.value = false
  drawerProcessHash.value = processHash
  drawerDocLoading.value = true
  try {
    drawerPackage.value = await documents.loadPackage(session.username, processHash)
  } catch {
    // Пустой ответ означает «документа ещё нет в реестре», сбой — отдельное
    // состояние: иначе ошибка выглядит как ожидание записи в цепь.
    drawerDocFailed.value = true
  } finally {
    drawerDocLoading.value = false
  }
}

function openHistory(row: MarketplaceInvestHistoryEntry): void {
  drawerOpen.value = false
  selectedHistory.value = row
  void loadPackage(row.process_hash)
}

function openProperty(row: MarketplaceInvestPropertyView): void {
  drawerOpen.value = false
  selectedProperty.value = row
}

function openInvestor(row: MarketplaceInvestorView): void {
  drawerOpen.value = false
  selectedInvestor.value = row
}

// ─── Сведения о принятом имуществе ───
// После приёма заявление стирается из цепи; что за имущество и кто его одобрил,
// берётся из документов пакета (акт, протокол) — по строкам «Имущество принято».
const propertyFacts = ref<Record<string, InvestPropertyFacts>>({})

async function loadPropertyFacts(rows: MarketplaceInvestHistoryEntry[]): Promise<void> {
  const todo = rows.filter((r) => r.kind === Zeus.MarketplaceInvestHistoryKind.PROPERTY && !propertyFacts.value[r.process_hash])
  await Promise.all(
    todo.map(async (r) => {
      try {
        const facts = propertyFactsOf(await documents.loadPackage(session.username, r.process_hash))
        if (facts) propertyFacts.value = { ...propertyFacts.value, [r.process_hash]: facts }
      } catch {
        // Без документов строка остаётся «Имущество принято» — сведения не обязательны.
      }
    }),
  )
}

/** Подпись строки истории: для принятого имущества — с наименованием. */
function historyKindLabel(row: MarketplaceInvestHistoryEntry): string {
  const name = row.kind === Zeus.MarketplaceInvestHistoryKind.PROPERTY ? propertyFacts.value[row.process_hash]?.name : undefined
  return name ? i18nT('marketplace.initiatorsPage.kindPropertyNamed', { name }) : i18nT(HISTORY_KIND[row.kind])
}

const selectedFacts = computed<InvestPropertyFacts | null>(() =>
  selectedHistory.value ? propertyFacts.value[selectedHistory.value.process_hash] ?? propertyFactsOf(drawerPackage.value) : null,
)

const drawerTitle = computed(() => {
  if (selectedHistory.value) return historyKindLabel(selectedHistory.value)
  if (selectedProperty.value) return propertyTitle(selectedProperty.value)
  if (selectedInvestor.value) return names.value[selectedInvestor.value.username] || selectedInvestor.value.username
  return ''
})

// ─── Подпись документов ───

const busy = ref(false)

async function signed(doc: InvestDocumentView, signatureId = 1) {
  return new DigitalDocument(doc).sign(session.username, signatureId)
}

function metaOf(doc: InvestDocumentView): Record<string, unknown> {
  return (typeof doc.meta === 'string' ? JSON.parse(doc.meta) : doc.meta) as Record<string, unknown>
}

/** Действие с подписью: занятость, сообщение об успехе, перечитывание. */
async function run(work: () => Promise<void>, success: MarketplaceMessageKey, failure: MarketplaceMessageKey): Promise<boolean> {
  busy.value = true
  try {
    await work()
    SuccessAlert(i18nT(success))
    await loadAll()
    return true
  } catch (e) {
    FailAlert(e, i18nT(failure))
    return false
  } finally {
    busy.value = false
  }
}

// Договор участия — как регистрация в Благоросте: текст сформирован при
// открытии и стоит на странице целиком, подпись — кнопкой в прилипшем подвале.
const agreementDoc = ref<InvestDocumentView | null>(null)
const agreementDocLoading = ref(false)
const agreementDocError = ref(false)

async function loadAgreementDoc(): Promise<void> {
  if (agreementDoc.value || agreementDocLoading.value) return
  agreementDocLoading.value = true
  agreementDocError.value = false
  try {
    agreementDoc.value = await getAgreementPayload()
  } catch {
    agreementDocError.value = true
  } finally {
    agreementDocLoading.value = false
  }
}

/** Лист подписи договора на экране: страница высотой до низа экрана, лист растягивается на остаток. */
const signView = computed(() => !firstLoad.value && !agreement.value && store.isOperator)

function pageStyle(offset: number, height: number): Record<string, string> {
  const rest = `${height - offset}px`
  return signView.value ? { height: rest } : { minHeight: rest }
}

async function onSignAgreement(): Promise<void> {
  const doc = agreementDoc.value
  if (!doc) return
  await run(
    async () => signAgreement({ agreement: await signed(doc) }),
    'marketplace.initiatorsPage.agreementSigned',
    'marketplace.initiatorsPage.agreementSignFailed',
  )
}

// Паевой взнос деньгами: сумма → заявление 1119 → подпись.
const moneyOpen = ref(false)
const moneySum = ref<number | null>(null)

async function onInvestMoney(): Promise<void> {
  const amount = Number(moneySum.value) || 0
  if (amount <= 0 || !braname.value) return
  const ok = await run(
    async () => {
      const doc = await getInvestStatementPayload({ braname: braname.value, amount })
      await investMoney({ braname: braname.value, amount, invest_hash: String(metaOf(doc).invest_hash), statement: await signed(doc) })
    },
    'marketplace.initiatorsPage.moneyDone',
    'marketplace.initiatorsPage.moneyFailed',
  )
  if (ok) {
    moneyOpen.value = false
    moneySum.value = null
  }
}

// Паевой взнос имуществом: наименование, описание, количество, цена → заявление 1120.
const propertyOpen = ref(false)
const emptyProperty = () => ({ name: '', description: '', quantity: '1', unit: '', amount: null as number | null })
const propertyForm = ref(emptyProperty())
const propertyValid = computed(() => {
  const f = propertyForm.value
  return Boolean(f.name.trim() && f.description.trim() && f.quantity.trim() && f.unit.trim() && Number(f.amount) > 0)
})

async function onCreateProperty(): Promise<void> {
  if (!propertyValid.value || !braname.value) return
  const f = propertyForm.value
  const fields = {
    braname: braname.value,
    property_name: f.name.trim(),
    property_description: f.description.trim(),
    property_quantity: f.quantity.trim(),
    property_unit: f.unit.trim(),
    amount: Number(f.amount),
  }
  const ok = await run(
    async () => {
      const doc = await getPropertyStatementPayload(fields)
      await createProperty({ ...fields, property_hash: String(metaOf(doc).property_hash), statement: await signed(doc) })
    },
    'marketplace.initiatorsPage.propertyDone',
    'marketplace.initiatorsPage.propertyFailed',
  )
  if (ok) {
    propertyOpen.value = false
    propertyForm.value = emptyProperty()
    activeKey.value = 'property'
  }
}

// Возврат: сумму считает контракт; заявление 1123 несёт предварительный расчёт.
const claimable = computed(() => amountOf(mine.value?.claimable))

async function onClaim(): Promise<void> {
  if (claimable.value <= 0 || !braname.value) return
  const yes = await confirm({
    title: i18nT('marketplace.initiatorsPage.claimConfirmTitle'),
    message: i18nT('marketplace.initiatorsPage.claimConfirmMessage', { amount: formatAsset2Digits(mine.value?.claimable ?? '') }),
    note: i18nT('marketplace.initiatorsPage.claimConfirmNote'),
    confirmLabel: i18nT('marketplace.initiatorsPage.claimAction'),
  })
  if (!yes) return
  await run(
    async () => {
      const doc = await getClaimPayload(braname.value)
      await claimInvestment({ braname: braname.value, claim_hash: String(metaOf(doc).claim_hash), statement: await signed(doc) })
    },
    'marketplace.initiatorsPage.claimDone',
    'marketplace.initiatorsPage.claimFailed',
  )
}

// Имущество: одобрение и отказ председателя участка, акт двумя подписями.
// Условия действий — общие со счётчиком дел на пункте меню.
const canApprove = (p: MarketplaceInvestPropertyView): boolean => canApproveProperty(p, isTrustee.value)
const canSignAct = (p: MarketplaceInvestPropertyView): boolean => canSignPropertyAct(p, session.username)
/** Акт ждёт второй подписи председателя совета — одобрение в совете. */
const isAwaitingChairman = (p: MarketplaceInvestPropertyView): boolean => p.status === Zeus.MarketplaceInvestPropertyStatus.ACT1

/** Председатель совета подписал или отклонил акт — перечитать страницу и число в меню. */
function onApprovalDecided(): void {
  void loadAll()
  void refreshMenuBadges(['marketplace-pvz-initiators'])
}

async function onApprove(p: MarketplaceInvestPropertyView): Promise<void> {
  const yes = await confirm({
    title: i18nT('marketplace.initiatorsPage.approveConfirmTitle'),
    message: i18nT('marketplace.initiatorsPage.approveConfirmMessage', { name: propertyTitle(p), amount: formatAsset2Digits(p.amount) }),
    confirmLabel: i18nT('marketplace.initiatorsPage.approveAction'),
  })
  if (!yes) return
  const ref_ = { braname: braname.value, property_hash: p.hash }
  await run(
    async () => approveProperty({ ...ref_, document: await signed(await getPropertyApprovalPayload(ref_)) }),
    'marketplace.initiatorsPage.approveDone',
    'marketplace.initiatorsPage.approveFailed',
  )
}

const declineTarget = ref<MarketplaceInvestPropertyView | null>(null)
const declineReason = ref('')
const declineOpen = computed({
  get: () => declineTarget.value !== null,
  set: (open: boolean) => {
    if (!open) declineTarget.value = null
  },
})

function openDecline(p: MarketplaceInvestPropertyView): void {
  declineReason.value = ''
  declineTarget.value = p
}

async function onDecline(): Promise<void> {
  const p = declineTarget.value
  const reason = declineReason.value.trim()
  if (!p || !reason) return
  const ok = await run(
    async () => declineProperty({ braname: braname.value, property_hash: p.hash, reason }),
    'marketplace.initiatorsPage.declineDone',
    'marketplace.initiatorsPage.declineFailed',
  )
  if (ok) declineTarget.value = null
}

/** Акт: вносящий подписывает первым, председатель участка — тот же акт вторым. */
// Вносящий подписывает акт первой подписью; вторую ставит председатель совета
// в одобрении (строка и панель показывают его кнопки, остальным — ожидание).
async function onAct(p: MarketplaceInvestPropertyView): Promise<void> {
  const ref_ = { braname: braname.value, property_hash: p.hash }
  await run(
    async () => {
      const doc = await getPropertyActPayload(ref_)
      const document = await signed(doc, 1)
      await signPropertyAct({ ...ref_, document })
    },
    'marketplace.initiatorsPage.actDone',
    'marketplace.initiatorsPage.actFailed',
  )
}
</script>

<template lang="pug">
q-page.initiators(:style-fn='pageStyle')
  OperatorBranchBar

  EmptyState(
    v-if='store.loaded && !store.isOperator',
    :title='$t("marketplace.initiatorsPage.notOperatorTitle")',
    :body='$t("marketplace.initiatorsPage.notOperatorBody")'
  )
    template(#icon)
      q-icon(name='volunteer_activism', size='48px')

  template(v-else)
    PageHint(storage-key='mp:operator-initiators:banner-dismissed')
      | {{ $t('marketplace.initiatorsPage.hint') }}

    //- Без договора — только договор: текст на всю высоту экрана, подпись — внизу.
    DocumentSignSheet(
      v-if='!firstLoad && !agreement',
      :title='$t("marketplace.initiatorsPage.agreementTitle")',
      :subtitle='$t("marketplace.initiatorsPage.agreementBody")',
      :html='agreementDoc ? agreementDoc.html : null',
      :loading='agreementDocLoading',
      :error='agreementDocError',
      :signing='busy',
      :sign-label='$t("marketplace.initiatorsPage.agreementAction")',
      :loading-text='$t("marketplace.initiatorsPage.agreementPreparing")',
      :error-text='$t("marketplace.initiatorsPage.agreementLoadFailed")',
      @sign='onSignAgreement',
      @retry='loadAgreementDoc'
    )

    template(v-else-if='agreement || firstLoad')
      PageTabs(:tabs='tabs', :active-key='activeKey', @select='onSelectTab')
        template(v-if='activeKey === "mine"', #actions)
          BaseButton(variant='secondary', size='sm', :disabled='busy', @click='propertyOpen = true')
            template(#icon-left)
              q-icon(name='inventory_2', size='16px')
            | {{ $t('marketplace.initiatorsPage.propertyAction') }}
          BaseButton(variant='secondary', size='sm', :disabled='busy', @click='moneyOpen = true')
            template(#icon-left)
              q-icon(name='payments', size='16px')
            | {{ $t('marketplace.initiatorsPage.moneyAction') }}
          BaseButton(variant='primary', size='sm', :disabled='busy || claimable <= 0', :loading='busy', @click='onClaim')
            template(#icon-left)
              q-icon(name='account_balance_wallet', size='16px')
            | {{ $t('marketplace.initiatorsPage.claimAction') }}
        template(v-else-if='activeKey === "initiators"', #actions)
          BaseButton(variant='primary', size='sm', :disabled='busy || claimable <= 0', :loading='busy', @click='onClaim')
            template(#icon-left)
              q-icon(name='account_balance_wallet', size='16px')
            | {{ $t('marketplace.initiatorsPage.claimAction') }}
        template(v-else-if='activeKey === "property"', #actions)
          BaseButton(variant='primary', size='sm', :disabled='busy', @click='propertyOpen = true')
            template(#icon-left)
              q-icon(name='add', size='16px')
            | {{ $t('marketplace.initiatorsPage.propertyAction') }}

      //- Вкладка уже называет раздел, поэтому подписей разделов над карточками и
      //- таблицами нет. Первая загрузка — нейтральный скелетон; затем либо пустое
      //- состояние, либо карточки сумм (как кошельки на «Экономике участка») и таблица.

      //- 1. Мои взносы
      template(v-if='activeKey === "mine"')
        template(v-if='firstLoad')
          .row.q-col-gutter-md
            .col-12.col-md-6(v-for='n in 4', :key='n')
              q-skeleton.initiators__skel-card(type='rect')
          q-skeleton.initiators__skel-table(type='rect')
        EmptyState(
          v-else-if='!hasMine',
          :title='$t("marketplace.initiatorsPage.mineEmptyTitle")',
          :body='$t("marketplace.initiatorsPage.mineEmptyBody")'
        )
          template(#icon)
            q-icon(name='volunteer_activism', size='48px')
        template(v-else)
          .row.q-col-gutter-md
            .col-12.col-md-6(v-for='c in myCards', :key='c.key')
              WalletCard(
                program='wallet',
                :icon='c.icon',
                :title='c.title',
                :subtitle='c.subtitle',
                :balance='amountOf(c.asset).toFixed(2)',
                :symbol='symbolOf(c.asset)',
                :balance-label='c.label'
              )
          BaseTable(
            v-if='history.length',
            :columns='historyColumns',
            :rows='history',
            row-key='global_sequence',
            min-width='640px',
            clickable-rows,
            @row-click='openHistory'
          )
            template(#cell-date='{ row }')
              span.t-mono {{ dateOf(row.created_at) }}
            template(#cell-kind='{ row }')
              | {{ historyKindLabel(row) }}
            template(#cell-amount='{ row }')
              span.t-mono {{ formatAsset2Digits(row.amount) }}
          .initiators__muted(v-else) {{ $t('marketplace.initiatorsPage.historyEmptyBody') }}

      //- 2. Имущество: заявления до приёма, ниже — принятое имущество из истории.
      template(v-if='activeKey === "property"')
        BaseTable(
          v-if='firstLoad || propertyRows.length',
          :columns='propertyColumns',
          :rows='propertyRows',
          row-key='key',
          :loading='firstLoad',
          min-width='960px',
          clickable-rows,
          @row-click='openPropertyRow'
        )
          template(#cell-title='{ row }')
            .initiators__name {{ row.name }}
            .initiators__muted(v-if='row.date') {{ row.date }}
          template(#cell-investor='{ row }')
            | {{ row.investor }}
          template(#cell-amount='{ row }')
            span.t-mono {{ formatAsset2Digits(row.amount) }}
          template(#cell-stage='{ row }')
            BaseBadge(v-if='row.pending', :variant='PROPERTY_STAGE[row.pending.status].variant') {{ $t(PROPERTY_STAGE[row.pending.status].label) }}
            BaseBadge(v-else, variant='pos') {{ $t('marketplace.initiatorsPage.stageAccepted') }}
          template(#cell-actions='{ row }')
            .initiators__row-actions(v-if='row.pending', @click.stop)
              template(v-if='canApprove(row.pending)')
                BaseButton(variant='secondary', size='sm', :disabled='busy', @click='openDecline(row.pending)') {{ $t('marketplace.initiatorsPage.declineAction') }}
                BaseButton(variant='primary', size='sm', :disabled='busy', @click='onApprove(row.pending)') {{ $t('marketplace.initiatorsPage.approveAction') }}
              BaseButton(v-else-if='canSignAct(row.pending)', variant='primary', size='sm', :disabled='busy', @click='onAct(row.pending)') {{ $t('marketplace.initiatorsPage.actAction') }}
              ChairmanApprovalActions(
                v-else-if='isAwaitingChairman(row.pending)',
                :coopname='coopname',
                :approval-hash='row.pending.hash',
                :title='$t("marketplace.initiatorsPage.actApprovalTitle", { name: row.name })',
                :declinable='false',
                @decided='onApprovalDecided'
              )
        EmptyState(
          v-else,
          :title='$t("marketplace.initiatorsPage.pendingEmptyTitle")',
          :body='$t("marketplace.initiatorsPage.pendingEmptyBody")'
        )
          template(#icon)
            q-icon(name='inventory_2', size='40px')

      //- 3. Инициаторы участка — председателю участка: итоги карточками, ниже строки инициаторов.
      template(v-if='activeKey === "initiators" && isTrustee')
        template(v-if='firstLoad')
          .row.q-col-gutter-md
            .col-12.col-md-6(v-for='n in 4', :key='n')
              q-skeleton.initiators__skel-card(type='rect')
          q-skeleton.initiators__skel-table(type='rect')
        EmptyState(
          v-else-if='!hasInvestors',
          :title='$t("marketplace.initiatorsPage.investorsEmptyTitle")',
          :body='$t("marketplace.initiatorsPage.investorsEmptyBody")'
        )
          template(#icon)
            q-icon(name='groups', size='40px')
        template(v-else)
          .row.q-col-gutter-md
            .col-12.col-md-6(v-for='c in branchCards', :key='c.key')
              WalletCard(
                program='wallet',
                :icon='c.icon',
                :title='c.title',
                :subtitle='c.subtitle',
                :balance='amountOf(c.asset).toFixed(2)',
                :symbol='symbolOf(c.asset)',
                :balance-label='c.label'
              )
          BaseTable(
            :columns='investorColumns',
            :rows='branchView ? branchView.investors : []',
            row-key='username',
            min-width='860px',
            clickable-rows,
            @row-click='openInvestor'
          )
            template(#cell-investor='{ row }')
              .initiators__name {{ names[row.username] || row.username }}
            template(#cell-invested='{ row }')
              span.t-mono {{ formatAsset2Digits(invested(row)) }}
            template(#cell-used='{ row }')
              span.t-mono {{ formatAsset2Digits(row.used) }}
            template(#cell-returned='{ row }')
              span.t-mono {{ formatAsset2Digits(row.returned) }}
            template(#cell-status='{ row }')
              BaseBadge(:variant='row.active ? "info" : "pos"') {{ row.active ? $t('marketplace.initiatorsPage.investorActive') : $t('marketplace.initiatorsPage.investorDone') }}

  //- Правая панель: запись истории, заявление на имущество или инициатор.
  DetailsDrawer(v-model='drawerOpen', :title='drawerTitle', :width='480')
    template(v-if='selectedHistory')
      .initiators__drawer-amount.t-mono {{ formatAsset2Digits(selectedHistory.amount) }}
      DataRow(:label='$t("marketplace.initiatorsPage.columnDate")', :value='dateOf(selectedHistory.created_at)', align='spread')
      DataRow(:label='$t("marketplace.initiatorsPage.operationNumber")', :value='selectedHistory.global_sequence', align='spread', mono)
      //- Принятое имущество: что это и кто одобрил заявление — из документов пакета.
      template(v-if='selectedFacts')
        DataRow(:label='$t("marketplace.investPropertyDecisionInfo.nameLabel")', :value='selectedFacts.name', align='spread')
        DataRow(v-if='selectedFacts.quantity', :label='$t("marketplace.investPropertyDecisionInfo.quantityLabel")', :value='[selectedFacts.quantity, selectedFacts.unit].filter(Boolean).join(" ")', align='spread')
        DataRow(v-if='selectedFacts.branchName', :label='$t("marketplace.investPropertyDecisionInfo.branchLabel")', :value='selectedFacts.branchName', align='spread')
        DataRow(v-if='selectedFacts.chairmanName', :label='$t("marketplace.investPropertyDecisionInfo.approvedByLabel")', :value='selectedFacts.chairmanName', align='spread')
        DataRow(v-if='selectedFacts.description', :label='$t("marketplace.investPropertyDecisionInfo.descriptionLabel")', :value='selectedFacts.description', align='vertical')
      .initiators__drawer-docs
        .initiators__section-title {{ $t('marketplace.initiatorsPage.documentsTitle') }}
        q-skeleton(v-if='drawerDocLoading', type='rect', height='48px')
        ComplexDocument(v-else-if='drawerPackage', :documents='drawerPackage', collapsible)
        template(v-else-if='drawerDocFailed')
          .initiators__muted {{ $t('marketplace.initiatorsPage.documentLoadFailed') }}
          div
            BaseButton(variant='secondary', size='sm', @click='loadPackage(drawerProcessHash)') {{ $t('marketplace.initiatorsPage.documentRetry') }}
        .initiators__muted(v-else) {{ $t('marketplace.initiatorsPage.documentPending') }}
    template(v-else-if='selectedProperty')
      .initiators__drawer-amount.t-mono {{ formatAsset2Digits(selectedProperty.amount) }}
      BaseBadge(:variant='PROPERTY_STAGE[selectedProperty.status].variant') {{ $t(PROPERTY_STAGE[selectedProperty.status].label) }}
      DataRow(:label='$t("marketplace.initiatorsPage.columnInvestor")', :value='names[selectedProperty.username] || selectedProperty.username', align='spread')
      DataRow(:label='$t("marketplace.initiatorsPage.propertyDescriptionLabel")', :value='selectedProperty.description', align='vertical')
    template(v-else-if='selectedInvestor')
      BaseBadge(:variant='selectedInvestor.active ? "info" : "pos"') {{ selectedInvestor.active ? $t('marketplace.initiatorsPage.investorActive') : $t('marketplace.initiatorsPage.investorDone') }}
      DataRow(:label='$t("marketplace.initiatorsPage.tileMoney")', :value='formatAsset2Digits(selectedInvestor.money)', align='spread')
      DataRow(:label='$t("marketplace.initiatorsPage.tileProperty")', :value='formatAsset2Digits(selectedInvestor.property)', align='spread')
      DataRow(:label='$t("marketplace.initiatorsPage.tileUsed")', :value='formatAsset2Digits(selectedInvestor.used)', align='spread')
      DataRow(:label='$t("marketplace.initiatorsPage.tileReturned")', :value='formatAsset2Digits(selectedInvestor.returned)', align='spread')
      DataRow(:label='$t("marketplace.initiatorsPage.tileClaimed")', :value='formatAsset2Digits(selectedInvestor.claimed)', align='spread')
      DataRow(:label='$t("marketplace.initiatorsPage.tileClaimable")', :value='formatAsset2Digits(selectedInvestor.claimable)', align='spread')
      DataRow(:label='$t("marketplace.initiatorsPage.tileUnused")', :value='formatAsset2Digits(selectedInvestor.unused)', align='spread')
    template(v-if='selectedProperty && (canApprove(selectedProperty) || canSignAct(selectedProperty) || isAwaitingChairman(selectedProperty))', #footer)
      template(v-if='canApprove(selectedProperty)')
        BaseButton(variant='secondary', :disabled='busy', @click='openDecline(selectedProperty)') {{ $t('marketplace.initiatorsPage.declineAction') }}
        BaseButton(variant='primary', :disabled='busy', @click='onApprove(selectedProperty)') {{ $t('marketplace.initiatorsPage.approveAction') }}
      BaseButton(v-else-if='canSignAct(selectedProperty)', variant='primary', :disabled='busy', @click='onAct(selectedProperty)') {{ $t('marketplace.initiatorsPage.actAction') }}
      ChairmanApprovalActions(
        v-else,
        :coopname='coopname',
        :approval-hash='selectedProperty.hash',
        :title='$t("marketplace.initiatorsPage.actApprovalTitle", { name: propertyTitle(selectedProperty) })',
        :declinable='false',
        @decided='onApprovalDecided'
      )

  //- Паевой взнос деньгами: паевой взнос переходит с главного кошелька на кошелёк договора участия.
  BaseDialog(v-model='moneyOpen', :title='$t("marketplace.initiatorsPage.moneyDialogTitle")', size='sm')
    BaseForm(:loading='busy', @submit='onInvestMoney')
      .initiators__muted.q-mb-md {{ $t('marketplace.initiatorsPage.moneyDialogHint') }}
      AmountInput(
        v-model='moneySum',
        :label='$t("marketplace.initiatorsPage.amountLabel")',
        placeholder='0,00',
        :symbol='symbol',
        :precision='2',
        :min='0'
      )
      template(#footer)
        BaseButton(variant='ghost', @click='moneyOpen = false') {{ $t('common.action.cancel') }}
        BaseButton(variant='primary', type='submit', :loading='busy', :disabled='!(Number(moneySum) > 0)') {{ $t('marketplace.initiatorsPage.moneyAction') }}

  //- Паевой взнос имуществом: заявление председателю участка, затем совет и акт.
  BaseDialog(v-model='propertyOpen', :title='$t("marketplace.initiatorsPage.propertyDialogTitle")', size='md')
    BaseForm(:loading='busy', @submit='onCreateProperty')
      .initiators__muted.q-mb-md {{ $t('marketplace.initiatorsPage.propertyDialogHint') }}
      BaseInput(v-model='propertyForm.name', :label='$t("marketplace.initiatorsPage.propertyNameLabel")')
      BaseInput(v-model='propertyForm.description', type='textarea', autogrow, :label='$t("marketplace.initiatorsPage.propertyDescriptionLabel")')
      .row.q-col-gutter-md
        .col-6
          BaseInput(v-model='propertyForm.quantity', :label='$t("marketplace.initiatorsPage.propertyQuantityLabel")')
        .col-6
          BaseInput(v-model='propertyForm.unit', :label='$t("marketplace.initiatorsPage.propertyUnitLabel")')
      AmountInput(
        v-model='propertyForm.amount',
        :label='$t("marketplace.initiatorsPage.propertyPriceLabel")',
        placeholder='0,00',
        :symbol='symbol',
        :precision='2',
        :min='0'
      )
      template(#footer)
        BaseButton(variant='ghost', @click='propertyOpen = false') {{ $t('common.action.cancel') }}
        BaseButton(variant='primary', type='submit', :loading='busy', :disabled='!propertyValid') {{ $t('marketplace.initiatorsPage.propertySubmit') }}

  //- Отказ председателя участка: причина обязательна, вопрос в совет не выносится.
  BaseDialog(v-model='declineOpen', :title='$t("marketplace.initiatorsPage.declineDialogTitle")', size='sm')
    BaseForm(:loading='busy', @submit='onDecline')
      BaseInput(v-model='declineReason', type='textarea', autogrow, :label='$t("marketplace.initiatorsPage.declineReasonLabel")')
      template(#footer)
        BaseButton(variant='ghost', @click='declineOpen = false') {{ $t('common.action.cancel') }}
        BaseButton(variant='danger', type='submit', :loading='busy', :disabled='!declineReason.trim()') {{ $t('marketplace.initiatorsPage.declineAction') }}
</template>

<style scoped>
.initiators {
  padding: var(--p-5);
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

.initiators__muted {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}

.initiators__skel-card {
  height: calc(var(--p-10) + var(--p-5));
  border-radius: var(--p-r-lg);
}

.initiators__skel-table {
  height: calc(var(--p-10) * 3);
  border-radius: var(--p-r-lg);
}

.initiators__section-title {
  font-size: var(--p-fs-eyebrow);
  font-weight: 600;
  color: var(--p-ink-2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.initiators__name {
  font-weight: 600;
  color: var(--p-ink);
}

.initiators__row-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2);
}

.initiators__drawer-amount {
  font-size: var(--p-fs-h2);
  font-weight: 700;
  color: var(--p-ink);
  margin-bottom: var(--p-3);
}

.initiators__drawer-docs {
  margin-top: var(--p-5);
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
</style>
