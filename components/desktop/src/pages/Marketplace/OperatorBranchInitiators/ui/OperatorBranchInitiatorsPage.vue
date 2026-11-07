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
import { Ledger2Contract } from 'cooptypes'
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseForm, BaseInput, BaseTable, EmptyState } from 'src/shared/ui/base'
import type { BaseBadgeVariant, BaseTableColumn } from 'src/shared/ui/base'
import { AmountInput, DataRow, DetailsDrawer, DocumentPreview, PageHint, StatStrip, type StatStripItem } from 'src/shared/ui/domain'
import { ComplexDocument } from 'src/shared/ui/ComplexDocument'
import { PageTabs, type PageTab } from 'src/shared/ui/layout'
import {
  type InvestDocumentView,
  type MarketplaceBranchInvestmentView,
  type MarketplaceInvestAgreementView,
  type MarketplaceInvestHistoryEntry,
  type MarketplaceInvestPropertyView,
  type MarketplaceInvestorView,
  acceptProperty,
  approveProperty,
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
 *  1. «Мои вложения» — что вложено, использовано, возвращено и доступно к
 *     возврату по выбранному участку; история вложений строками. Действия в
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

/** Сколько записей истории показываем: последние вложения и возвраты. */
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
    if (!agreement.value) return
    const [rows, view, page] = await Promise.all([
      listMyInvestments(),
      getBranchInvestment(braname.value),
      getMyInvestHistory({ page: 1, limit: HISTORY_LIMIT, sortOrder: 'DESC' }),
    ])
    myRows.value = rows
    branchView.value = view
    history.value = page.items
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

// Договоры, вложения, заявления на имущество — таблицы контракта; кошелёк
// вложения — ledger2; документы истории — реестр документов узла.
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

function tile(key: string, caption: string, asset: string | undefined, sub: string, icon?: string): StatStripItem {
  return { key, caption, value: amountOf(asset).toFixed(2), symbol: symbolOf(asset), sub, icon }
}

const symbol = computed(() => symbolOf(mine.value?.money ?? branchView.value?.money_total))

/** Плитки по пути денег: внесено → использовано → возвращено → доступно → не израсходовано. */
const myTiles = computed<StatStripItem[]>(() => {
  const m = mine.value
  return [
    tile('money', i18nT('marketplace.initiatorsPage.tileMoney'), m?.money, i18nT('marketplace.initiatorsPage.tileMoneySub'), 'payments'),
    tile('property', i18nT('marketplace.initiatorsPage.tileProperty'), m?.property, i18nT('marketplace.initiatorsPage.tilePropertySub'), 'inventory_2'),
    tile('used', i18nT('marketplace.initiatorsPage.tileUsed'), m?.used, i18nT('marketplace.initiatorsPage.tileUsedSub')),
    tile('returned', i18nT('marketplace.initiatorsPage.tileReturned'), m?.returned, i18nT('marketplace.initiatorsPage.tileReturnedSub')),
    tile('claimable', i18nT('marketplace.initiatorsPage.tileClaimable'), m?.claimable, i18nT('marketplace.initiatorsPage.tileClaimableSub'), 'account_balance_wallet'),
    tile('unused', i18nT('marketplace.initiatorsPage.tileUnused'), m?.unused, i18nT('marketplace.initiatorsPage.tileUnusedSub')),
  ]
})

const branchTiles = computed<StatStripItem[]>(() => {
  const b = branchView.value
  return [
    tile('money_total', i18nT('marketplace.initiatorsPage.tileBranchMoney'), b?.money_total, i18nT('marketplace.initiatorsPage.tileBranchMoneySub')),
    tile('property_total', i18nT('marketplace.initiatorsPage.tileBranchProperty'), b?.property_total, i18nT('marketplace.initiatorsPage.tileBranchPropertySub')),
    tile('spent_total', i18nT('marketplace.initiatorsPage.tileBranchSpent'), b?.spent_total, i18nT('marketplace.initiatorsPage.tileBranchSpentSub')),
    tile('unused_total', i18nT('marketplace.initiatorsPage.tileBranchUnused'), b?.unused_total, i18nT('marketplace.initiatorsPage.tileBranchUnusedSub')),
    tile('repaid_total', i18nT('marketplace.initiatorsPage.tileBranchRepaid'), b?.repaid_total, i18nT('marketplace.initiatorsPage.tileBranchRepaidSub')),
    tile('outstanding', i18nT('marketplace.initiatorsPage.tileBranchOutstanding'), b?.outstanding, i18nT('marketplace.initiatorsPage.tileBranchOutstandingSub')),
  ]
})

const PHASE: Record<Zeus.MarketplaceInvestPhase, { label: string; variant: BaseBadgeVariant }> = {
  [Zeus.MarketplaceInvestPhase.NONE]: { label: 'marketplace.initiatorsPage.phaseNone', variant: 'neutral' },
  [Zeus.MarketplaceInvestPhase.FUNDING]: { label: 'marketplace.initiatorsPage.phaseFunding', variant: 'warn' },
  [Zeus.MarketplaceInvestPhase.RETURNING]: { label: 'marketplace.initiatorsPage.phaseReturning', variant: 'info' },
  [Zeus.MarketplaceInvestPhase.RETURNED]: { label: 'marketplace.initiatorsPage.phaseReturned', variant: 'pos' },
}
const phase = computed(() => PHASE[branchView.value?.phase ?? Zeus.MarketplaceInvestPhase.NONE])

const PROPERTY_STAGE: Record<Zeus.MarketplaceInvestPropertyStatus, { label: string; variant: BaseBadgeVariant }> = {
  [Zeus.MarketplaceInvestPropertyStatus.CREATED]: { label: 'marketplace.initiatorsPage.stageCreated', variant: 'info' },
  [Zeus.MarketplaceInvestPropertyStatus.APPROVED]: { label: 'marketplace.initiatorsPage.stageApproved', variant: 'info' },
  [Zeus.MarketplaceInvestPropertyStatus.AUTHORIZED]: { label: 'marketplace.initiatorsPage.stageAuthorized', variant: 'warn' },
  [Zeus.MarketplaceInvestPropertyStatus.ACT1]: { label: 'marketplace.initiatorsPage.stageAct1', variant: 'warn' },
}

const HISTORY_KIND: Record<Zeus.MarketplaceInvestHistoryKind, string> = {
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

const propertyColumns = computed<BaseTableColumn<MarketplaceInvestPropertyView>[]>(() => [
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
  drawerDocLoading.value = true
  try {
    drawerPackage.value = await documents.loadDocument(session.username, processHash)
  } catch {
    // Документ дойдёт до реестра с лентой; панель покажет факты без него.
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

const drawerTitle = computed(() => {
  if (selectedHistory.value) return i18nT(HISTORY_KIND[selectedHistory.value.kind])
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
async function run(work: () => Promise<void>, success: string, failure: string): Promise<boolean> {
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

// Договор участия: просмотр текста, затем подпись.
const agreementOpen = ref(false)
const agreementDoc = ref<InvestDocumentView | null>(null)
const agreementDocLoading = ref(false)

async function openAgreement(): Promise<void> {
  agreementOpen.value = true
  agreementDocLoading.value = true
  try {
    agreementDoc.value = await getAgreementPayload()
  } catch (e) {
    FailAlert(e, i18nT('marketplace.initiatorsPage.agreementLoadFailed'))
    agreementOpen.value = false
  } finally {
    agreementDocLoading.value = false
  }
}

async function onSignAgreement(): Promise<void> {
  const doc = agreementDoc.value
  if (!doc) return
  const ok = await run(
    async () => signAgreement({ agreement: await signed(doc) }),
    'marketplace.initiatorsPage.agreementSigned',
    'marketplace.initiatorsPage.agreementSignFailed',
  )
  if (ok) agreementOpen.value = false
}

// Вложение деньгами: сумма → заявление 1119 → подпись.
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

// Вложение имуществом: наименование, описание, количество, цена → заявление 1120.
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
function canApprove(p: MarketplaceInvestPropertyView): boolean {
  return isTrustee.value && p.status === Zeus.MarketplaceInvestPropertyStatus.CREATED
}

function canSignAct(p: MarketplaceInvestPropertyView): boolean {
  return p.username === session.username && p.status === Zeus.MarketplaceInvestPropertyStatus.AUTHORIZED
}

function canAccept(p: MarketplaceInvestPropertyView): boolean {
  return isTrustee.value && p.status === Zeus.MarketplaceInvestPropertyStatus.ACT1
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
async function onAct(p: MarketplaceInvestPropertyView, second: boolean): Promise<void> {
  const ref_ = { braname: braname.value, property_hash: p.hash }
  await run(
    async () => {
      const doc = await getPropertyActPayload(ref_)
      const document = await signed(doc, second ? 2 : 1)
      await (second ? acceptProperty({ ...ref_, document }) : signPropertyAct({ ...ref_, document }))
    },
    second ? 'marketplace.initiatorsPage.acceptDone' : 'marketplace.initiatorsPage.actDone',
    'marketplace.initiatorsPage.actFailed',
  )
}
</script>

<template lang="pug">
q-page.initiators
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

    //- Без договора — только договор: подписать его — первый шаг инициатора.
    BaseCard.initiators__agreement(v-if='!firstLoad && !agreement')
      .initiators__agreement-body
        q-icon.initiators__agreement-icon(name='handshake', size='28px')
        .initiators__agreement-text
          .initiators__agreement-title {{ $t('marketplace.initiatorsPage.agreementTitle') }}
          .initiators__agreement-sub {{ $t('marketplace.initiatorsPage.agreementBody') }}
        BaseButton(variant='primary', :loading='agreementDocLoading', @click='openAgreement')
          template(#icon-left)
            q-icon(name='draw', size='16px')
          | {{ $t('marketplace.initiatorsPage.agreementAction') }}

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
        template(v-else-if='activeKey === "property"', #actions)
          BaseButton(variant='primary', size='sm', :disabled='busy', @click='propertyOpen = true')
            template(#icon-left)
              q-icon(name='add', size='16px')
            | {{ $t('marketplace.initiatorsPage.propertyAction') }}

      //- Фаза участка — одним бейджем; под ним только новое: сколько осталось вернуть.
      .initiators__phase(v-if='branchView')
        BaseBadge(:variant='phase.variant') {{ $t(phase.label) }}
        span.initiators__phase-note(v-if='amountOf(branchView.outstanding) > 0')
          | {{ $t('marketplace.initiatorsPage.outstandingNote', { amount: formatAsset2Digits(branchView.outstanding) }) }}

      //- 1. Мои вложения
      template(v-if='activeKey === "mine"')
        StatStrip(:items='myTiles', :loading='firstLoad')

        .initiators__section
          .initiators__section-title {{ $t('marketplace.initiatorsPage.historyTitle') }}
          BaseTable(
            v-if='firstLoad || history.length',
            :columns='historyColumns',
            :rows='history',
            row-key='global_sequence',
            :loading='firstLoad',
            min-width='640px',
            clickable-rows,
            @row-click='openHistory'
          )
            template(#cell-date='{ row }')
              span.t-mono {{ dateOf(row.created_at) }}
            template(#cell-kind='{ row }')
              | {{ $t(HISTORY_KIND[row.kind]) }}
            template(#cell-amount='{ row }')
              span.t-mono {{ formatAsset2Digits(row.amount) }}
          EmptyState(
            v-else,
            :title='$t("marketplace.initiatorsPage.historyEmptyTitle")',
            :body='$t("marketplace.initiatorsPage.historyEmptyBody")'
          )
            template(#icon)
              q-icon(name='history', size='40px')

      //- 2. Имущество
      template(v-if='activeKey === "property"')
        .initiators__section
          .initiators__section-title {{ $t('marketplace.initiatorsPage.pendingTitle') }}
          BaseTable(
            v-if='firstLoad || pendingProperties.length',
            :columns='propertyColumns',
            :rows='pendingProperties',
            row-key='hash',
            :loading='firstLoad',
            min-width='960px',
            clickable-rows,
            @row-click='openProperty'
          )
            template(#cell-title='{ row }')
              .initiators__name {{ propertyTitle(row) }}
            template(#cell-investor='{ row }')
              | {{ names[row.username] || row.username }}
            template(#cell-amount='{ row }')
              span.t-mono {{ formatAsset2Digits(row.amount) }}
            template(#cell-stage='{ row }')
              BaseBadge(:variant='PROPERTY_STAGE[row.status].variant') {{ $t(PROPERTY_STAGE[row.status].label) }}
            template(#cell-actions='{ row }')
              .initiators__row-actions(@click.stop)
                template(v-if='canApprove(row)')
                  BaseButton(variant='secondary', size='sm', :disabled='busy', @click='openDecline(row)') {{ $t('marketplace.initiatorsPage.declineAction') }}
                  BaseButton(variant='primary', size='sm', :disabled='busy', @click='onApprove(row)') {{ $t('marketplace.initiatorsPage.approveAction') }}
                BaseButton(v-else-if='canSignAct(row)', variant='primary', size='sm', :disabled='busy', @click='onAct(row, false)') {{ $t('marketplace.initiatorsPage.actAction') }}
                BaseButton(v-else-if='canAccept(row)', variant='primary', size='sm', :disabled='busy', @click='onAct(row, true)') {{ $t('marketplace.initiatorsPage.acceptAction') }}
          EmptyState(
            v-else,
            :title='$t("marketplace.initiatorsPage.pendingEmptyTitle")',
            :body='$t("marketplace.initiatorsPage.pendingEmptyBody")'
          )
            template(#icon)
              q-icon(name='inventory_2', size='40px')

        .initiators__section(v-if='acceptedProperties.length')
          .initiators__section-title {{ $t('marketplace.initiatorsPage.acceptedTitle') }}
          BaseTable(
            :columns='historyColumns',
            :rows='acceptedProperties',
            row-key='global_sequence',
            min-width='640px',
            clickable-rows,
            @row-click='openHistory'
          )
            template(#cell-date='{ row }')
              span.t-mono {{ dateOf(row.created_at) }}
            template(#cell-kind='{ row }')
              | {{ $t(HISTORY_KIND[row.kind]) }}
            template(#cell-amount='{ row }')
              span.t-mono {{ formatAsset2Digits(row.amount) }}

      //- 3. Инициаторы участка — председателю участка
      template(v-if='activeKey === "initiators" && isTrustee')
        StatStrip(:items='branchTiles', :loading='firstLoad')

        .initiators__section
          BaseTable(
            v-if='firstLoad || (branchView && branchView.investors.length)',
            :columns='investorColumns',
            :rows='branchView ? branchView.investors : []',
            row-key='username',
            :loading='firstLoad',
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
          EmptyState(
            v-else,
            :title='$t("marketplace.initiatorsPage.investorsEmptyTitle")',
            :body='$t("marketplace.initiatorsPage.investorsEmptyBody")'
          )
            template(#icon)
              q-icon(name='groups', size='40px')

  //- Правая панель: запись истории, заявление на имущество или инициатор.
  DetailsDrawer(v-model='drawerOpen', :title='drawerTitle', :width='480')
    template(v-if='selectedHistory')
      .initiators__drawer-amount.t-mono {{ formatAsset2Digits(selectedHistory.amount) }}
      DataRow(:label='$t("marketplace.initiatorsPage.columnDate")', :value='dateOf(selectedHistory.created_at)', align='spread')
      DataRow(:label='$t("marketplace.initiatorsPage.operationNumber")', :value='selectedHistory.global_sequence', align='spread', mono)
      .initiators__drawer-docs
        .initiators__section-title {{ $t('marketplace.initiatorsPage.documentsTitle') }}
        q-skeleton(v-if='drawerDocLoading', type='rect', height='48px')
        ComplexDocument(v-else-if='drawerPackage', :documents='drawerPackage', collapsible)
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
    template(v-if='selectedProperty && (canApprove(selectedProperty) || canSignAct(selectedProperty) || canAccept(selectedProperty))', #footer)
      template(v-if='canApprove(selectedProperty)')
        BaseButton(variant='secondary', :disabled='busy', @click='openDecline(selectedProperty)') {{ $t('marketplace.initiatorsPage.declineAction') }}
        BaseButton(variant='primary', :disabled='busy', @click='onApprove(selectedProperty)') {{ $t('marketplace.initiatorsPage.approveAction') }}
      BaseButton(v-else-if='canSignAct(selectedProperty)', variant='primary', :disabled='busy', @click='onAct(selectedProperty, false)') {{ $t('marketplace.initiatorsPage.actAction') }}
      BaseButton(v-else, variant='primary', :disabled='busy', @click='onAct(selectedProperty, true)') {{ $t('marketplace.initiatorsPage.acceptAction') }}

  //- Договор участия: текст на просмотр, затем подпись.
  BaseDialog(v-model='agreementOpen', :title='$t("marketplace.initiatorsPage.agreementTitle")', size='lg')
    DocumentPreview(
      :document='{ type: "html", html: agreementDoc?.html ?? "" }',
      :loading='agreementDocLoading',
      profile='document',
      height='60vh'
    )
    template(#footer)
      BaseButton(variant='ghost', @click='agreementOpen = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='busy', :disabled='!agreementDoc', @click='onSignAgreement') {{ $t('marketplace.initiatorsPage.agreementAction') }}

  //- Вложение деньгами: паевой взнос переходит с главного кошелька на кошелёк договора участия.
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

  //- Вложение имуществом: заявление председателю участка, затем совет и акт.
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

.initiators__agreement-body {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--p-4);
  align-items: center;
}

.initiators__agreement-icon {
  color: var(--p-primary);
}

.initiators__agreement-title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
}

.initiators__agreement-sub,
.initiators__muted,
.initiators__phase-note {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}

.initiators__phase {
  display: flex;
  align-items: center;
  gap: var(--p-3);
}

.initiators__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
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

@media (max-width: 600px) {
  .initiators__agreement-body {
    grid-template-columns: auto minmax(0, 1fr);
  }
}
</style>
