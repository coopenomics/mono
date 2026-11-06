<template lang="pug">
//- Фонды кооператива на кошельках учётной книги (задача 99D-24). Кошелёк и есть
//- субсчёт фонда: остаток — остаток кошелька, обороты и история — операции
//- учётной книги, у которых кошелёк фонда стоит источником или получателем.
//- Зоны страницы сверху вниз: подсказка — что такое фонды и как они пополняются;
//- плитки — сколько денег в фондах и как они двигались за период (период
//- выбирается кнопкой в шапке приложения); таблица — каждый фонд; панель справа —
//- история и настройки фонда.
div.funds-page
  PageHint(storage-key='reports:funds:banner-dismissed')
    | {{ $t('reports.fundsPage.hint') }}

  StatStrip(:items='stats' :loading='firstLoad' :framed='false')

  BaseTable(
    :columns='columns'
    :rows='funds'
    row-key='id'
    :loading='firstLoad'
    clickable-rows
    :skeleton-rows='5'
    @row-click='openFund'
  )
    template(#cell-kind='{ row }')
      BaseChip(:variant='row.kind === ACCUM ? "info" : "neutral"' size='sm') {{ kindLabel(row.kind) }}
    template(#cell-wallet='{ row }')
      WalletIdCell(:wallet-name='row.wallet')
    template(#cell-percent='{ row }')
      span(v-if='row.kind === ACCUM') {{ percentLabel(row.percent) }}
      span.t-faint(v-else) —

  //- Панель фонда: остаток крупно, обороты, настройки; вкладки «История» и «О фонде».
  DetailsDrawer(v-model='drawerOpen' :title='selected ? selected.name : ""' :width='560')
    template(v-if='selected')
      .funds-page__drawer-amount
        .t-muted {{ $t('reports.fundsPage.availableLabel') }}
        .funds-page__drawer-sum {{ formatAsset2Digits(selected.available) }}
        .t-faint {{ $t('reports.fundsPage.walletLine', { wallet: selected.wallet, account: accountLabel(selected.account) }) }}
      q-tabs(v-model='drawerTab' dense align='left' no-caps)
        q-tab(name='history' :label='$t("reports.fundsPage.tabs.history")')
        q-tab(name='about' :label='$t("reports.fundsPage.tabs.about")')
      q-separator
      .funds-page__drawer-body
        template(v-if='drawerTab === "history"')
          //- Узкая панель — лента строк, а не широкая таблица: слева операция и
          //- мета-строка (дата · кошелёк другой стороны), справа сумма со знаком.
          //- Строка с процессом открывает его операции в реестре.
          .funds-page__history(v-if='movements.length || historyLoading')
            template(v-if='historyLoading && !movements.length')
              q-skeleton.funds-page__history-skel(v-for='n in 4' :key='n' type='rect' height='48px')
            button.funds-page__history-row(
              v-for='row in movements'
              :key='row.global_sequence'
              type='button'
              :class='{ "funds-page__history-row--link": !!row.process_hash }'
              :disabled='!row.process_hash'
              @click='toProcess(row)'
            )
              .funds-page__history-main
                .funds-page__history-title {{ row.operation_name }}
                .funds-page__history-meta {{ historyMeta(row) }}
              .funds-page__num.funds-page__history-amount(:class='row.direction === IN ? "funds-page__in" : "funds-page__out"') {{ formatAsset2Digits(row.amount) }}
          EmptyState(
            v-else
            :title='$t("reports.fundsPage.historyEmptyTitle")'
            :body='$t("reports.fundsPage.historyEmptyBody")'
          )
          .funds-page__more(v-if='hasMore')
            BaseButton(variant='secondary' size='sm' :loading='historyLoading' @click='loadMore') {{ $t('reports.fundsPage.showMoreLabel') }}
        template(v-else)
          DataRow(align='spread' :label='$t("reports.fundsPage.column.kind")' :value='kindLabel(selected.kind)')
          DataRow(v-if='selected.kind === ACCUM' align='spread' :label='$t("reports.fundsPage.percentLabel")' :value='percentLabel(selected.percent)' mono)
          DataRow(align='spread' :label='$t("reports.fundsPage.walletLabel")' :value='selected.wallet' mono copyable)
          DataRow(align='spread' :label='$t("reports.fundsPage.accountLabel")' :value='accountLabel(selected.account)' mono)
          DataRow(align='spread' :label='$t("reports.fundsPage.incomeLabel")' :value='formatAsset2Digits(selected.income)' mono)
          DataRow(align='spread' :label='$t("reports.fundsPage.outcomeLabel")' :value='formatAsset2Digits(selected.outcome)' mono)
          .funds-page__description
            .t-muted {{ $t('reports.fundsPage.descriptionLabel') }}
            p(v-if='selected.description') {{ selected.description }}
            p.t-faint(v-else) {{ $t('reports.fundsPage.noDescription') }}
    template(#footer v-if='selected && canEdit')
      BaseButton(variant='primary' @click='openEdit') {{ $t('reports.fundsPage.editLabel') }}

  //- Правка описания и процента — только председателю совета. Сумма процентов
  //- фондов накопления проверяется до отправки: отказ виден сразу.
  BaseDialog(v-model='editOpen' :title='$t("reports.fundsPage.editTitle")' size='sm')
    .funds-page__dialog(v-if='selected')
      BaseInput(
        v-model='editDescription'
        type='textarea'
        :rows='3'
        :label='$t("reports.fundsPage.descriptionField")'
      )
      BaseInput(
        v-if='selected.kind === ACCUM'
        v-model='editPercent'
        type='number'
        :label='$t("reports.fundsPage.percentField")'
        :hint='$t("reports.fundsPage.percentFieldHint", { others: percentLabel(othersPercent) })'
        :error='percentError'
      )
    template(#footer)
      BaseButton(variant='secondary' @click='editOpen = false') {{ $t('reports.fundsPage.cancelLabel') }}
      BaseButton(variant='primary' :loading='saving' :disabled='!!percentError' @click='saveEdit') {{ $t('reports.fundsPage.saveLabel') }}
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { FundContract } from 'cooptypes'
import { Zeus } from '@coopenomics/sdk'
import { useLiveReload, liveTable } from 'src/shared/lib/realtime'
import { useSystemStore } from 'src/entities/System/model'
import { useSessionStore } from 'src/entities/Session/model'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { addAssets, formatAsset2Digits } from 'src/shared/lib/utils'
import { useFirstLoad } from 'src/shared/lib/composables'
import { useHeaderActions } from 'src/shared/hooks/useHeaderActions'
import { BaseButton, BaseChip, BaseDialog, BaseInput, BaseTable, EmptyState } from 'src/shared/ui/base'
import type { BaseTableColumn } from 'src/shared/ui/base'
import { DataRow, DetailsDrawer, PageHint, StatStrip, type StatStripItem } from 'src/shared/ui/domain'
import { LEDGER_LIVE_TABLES } from 'app/extensions/reports/shared/lib/live'
import {
  editDeskFund,
  loadDeskFundHistory,
  loadDeskFunds,
  type IDeskFund,
  type IDeskFundMovement,
} from 'app/extensions/reports/shared/lib/registries'
import { WalletIdCell } from '../../../shared/ui'
import { fundsPeriod, fundsPeriodRange } from '../model/period'
import FundsPeriodButton from './FundsPeriodButton.vue'
import { t } from '../../../i18n'

const { info } = useSystemStore()
const session = useSessionStore()
const { isChairman } = storeToRefs(session)
const router = useRouter()

/** Фонды реестра живут по строке `funds` контракта fund и по кошелькам учётной книги. */
const FUNDS_LIVE_TABLES = [...LEDGER_LIVE_TABLES, liveTable(FundContract, FundContract.Tables.Funds)]
const HISTORY_PAGE = 20
/** Значения перечислений схемы: вид фонда и направление движения. */
const ACCUM = Zeus.ReportsFundKind.ACCUMULATION
const IN = Zeus.ReportsFundMovementDirection.IN

// Первая загрузка показывает каркас таблицы, не «пусто».
const loading = ref(true)
const firstLoad = useFirstLoad(loading)
const funds = ref<IDeskFund[]>([])

/** Кнопка периода — в шапке приложения, справа. */
const { registerAction, unregisterAction } = useHeaderActions()
const PERIOD_ACTION_ID = 'reports-funds-period'

const drawerOpen = ref(false)
const drawerTab = ref<'history' | 'about'>('history')
const selectedId = ref<number | null>(null)
const selected = computed(() => funds.value.find((f) => f.id === selectedId.value) ?? null)

const movements = ref<IDeskFundMovement[]>([])
const historyLoading = ref(false)
const historyPage = ref(1)
const historyTotalPages = ref(0)
const hasMore = computed(() => historyPage.value < historyTotalPages.value)

const editOpen = ref(false)
const editDescription = ref('')
const editPercent = ref('')
const saving = ref(false)

const canEdit = computed(() => isChairman.value)

/** Сумма сумм пяти фондов: остаток и обороты за период — для плиток над таблицей. */
function total(pick: (f: IDeskFund) => string): string {
  return formatAsset2Digits(funds.value.map(pick).reduce((acc, v) => addAssets(acc, v), '0'))
}

/** Плитки по пути денег: сколько в фондах → что поступило → что списано. */
const stats = computed<StatStripItem[]>(() => {
  const periodSub = t(`reports.fundsPage.periodSub.${fundsPeriod.value}`)
  return [
    { key: 'available', caption: t('reports.fundsPage.stats.available'), value: total((f) => f.available), sub: t('reports.fundsPage.stats.availableSub'), icon: 'account_balance' },
    { key: 'income', caption: t('reports.fundsPage.stats.income'), value: total((f) => f.income), sub: periodSub, icon: 'south_west' },
    { key: 'outcome', caption: t('reports.fundsPage.stats.outcome'), value: total((f) => f.outcome), sub: periodSub, icon: 'north_east' },
  ]
})

/** Сумма процентов остальных фондов накопления — чтобы отказ по сумме был виден до отправки. */
const othersPercent = computed(() => {
  if (!selected.value) return 0
  return funds.value
    .filter((f) => f.kind === ACCUM && f.id !== selected.value?.id)
    .reduce((sum, f) => sum + Number(f.percent), 0)
})

const percentError = computed(() => {
  if (!selected.value || selected.value.kind !== ACCUM) return undefined
  const value = Number(editPercent.value)
  if (!editPercent.value || Number.isNaN(value) || value <= 0 || value > 100) {
    return t('reports.fundsPage.percentInvalidError')
  }
  if (othersPercent.value + value > 100) return t('reports.fundsPage.percentSumError')
  return undefined
})

const columns: BaseTableColumn<IDeskFund>[] = [
  { key: 'name', label: t('reports.fundsPage.column.fund'), field: 'name' },
  { key: 'kind', label: t('reports.fundsPage.column.kind') },
  { key: 'wallet', label: t('reports.fundsPage.column.wallet') },
  { key: 'percent', label: t('reports.fundsPage.column.percent'), align: 'right' },
  { key: 'available', label: t('reports.fundsPage.column.available'), align: 'right', numeric: true, field: (row) => formatAsset2Digits(row.available) },
  { key: 'income', label: t('reports.fundsPage.column.income'), align: 'right', numeric: true, field: (row) => formatAsset2Digits(row.income) },
  { key: 'outcome', label: t('reports.fundsPage.column.outcome'), align: 'right', numeric: true, field: (row) => formatAsset2Digits(row.outcome) },
]

/** Мета-строка движения: дата и, если есть, кошелёк другой стороны. */
function historyMeta(row: IDeskFundMovement): string {
  const counterparty = row.counterparty_name || row.counterparty_wallet;
  return [formatDate(row.created_at), counterparty].filter(Boolean).join(' · ');
}


function kindLabel(kind: string): string {
  return kind === ACCUM ? t('reports.fundsPage.kind.accum') : t('reports.fundsPage.kind.expend')
}

function percentLabel(value: number): string {
  return `${Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} %`
}

/** Счёт плана ×1000 → номер счёта: 86000 → «86». */
function accountLabel(account: number): string {
  return account ? String(Math.round(account / 1000)).padStart(2, '0') : '—'
}

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function periodInput() {
  return { coopname: info.coopname, ...fundsPeriodRange(fundsPeriod.value) }
}

async function load(): Promise<void> {
  try {
    const registry = await loadDeskFunds(periodInput())
    funds.value = registry.funds
  } catch (e) {
    FailAlert(e)
  } finally {
    loading.value = false
  }
}

async function loadHistory(page: number): Promise<void> {
  if (!selected.value) return
  historyLoading.value = true
  try {
    const result = await loadDeskFundHistory({ ...periodInput(), fund_id: selected.value.id }, page, HISTORY_PAGE)
    movements.value = page === 1 ? result.items : [...movements.value, ...result.items]
    historyPage.value = result.currentPage
    historyTotalPages.value = result.totalPages
  } catch (e) {
    FailAlert(e)
  } finally {
    historyLoading.value = false
  }
}

function openFund(row: IDeskFund): void {
  selectedId.value = row.id
  drawerTab.value = 'history'
  movements.value = []
  drawerOpen.value = true
  void loadHistory(1)
}

function loadMore(): void {
  void loadHistory(historyPage.value + 1)
}

/** Строка истории открывает реестр операций по хэшу процесса: заказ, записка, заявление. */
function toProcess(row: IDeskFundMovement): void {
  if (!row.process_hash) return
  void router.push({ name: 'reports-operations', query: { process_hash: row.process_hash ?? '' } })
}

function openEdit(): void {
  if (!selected.value) return
  editDescription.value = selected.value.description
  editPercent.value = selected.value.kind === ACCUM ? String(selected.value.percent) : '0'
  editOpen.value = true
}

async function saveEdit(): Promise<void> {
  if (!selected.value || percentError.value) return
  saving.value = true
  try {
    await editDeskFund({
      coopname: info.coopname,
      fund_id: selected.value.id,
      description: editDescription.value,
      percent: selected.value.kind === ACCUM ? Number(editPercent.value) : 0,
    })
    SuccessAlert(t('reports.fundsPage.savedMessage'))
    editOpen.value = false
    await load()
  } catch (e) {
    FailAlert(e)
  } finally {
    saving.value = false
  }
}

watch(fundsPeriod, () => {
  void load()
  if (drawerOpen.value) void loadHistory(1)
})

onMounted(() => {
  registerAction({ id: PERIOD_ACTION_ID, component: FundsPeriodButton, order: 10 })
  void load()
})
onBeforeUnmount(() => unregisterAction(PERIOD_ACTION_ID))
useLiveReload(FUNDS_LIVE_TABLES, async () => {
  await load()
  if (drawerOpen.value) await loadHistory(1)
})
</script>

<style scoped lang="scss">
.funds-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);

  @media (max-width: 768px) {
    padding: var(--p-4);
  }
}

.funds-page__num {
  font-variant-numeric: tabular-nums;
}

.funds-page__in {
  color: var(--p-pos);
}

.funds-page__out {
  color: var(--p-ink);
}

.funds-page__drawer-amount {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  padding-bottom: var(--p-4);
}

.funds-page__drawer-sum {
  font-size: var(--p-fs-h1);
  line-height: var(--p-lh-h1);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.funds-page__drawer-body {
  padding-top: var(--p-4);
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.funds-page__description p {
  margin: var(--p-1) 0 0;
}

.funds-page__history {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  overflow: hidden;
}

.funds-page__history-skel {
  margin: var(--p-2) var(--p-3);
}

.funds-page__history-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--p-4);
  padding: var(--p-3) var(--p-4);
  border: 0;
  border-bottom: 1px solid var(--p-line);
  background: var(--p-surface);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: default;

  &:last-child {
    border-bottom: 0;
  }
}

.funds-page__history-row--link {
  cursor: pointer;

  &:hover {
    background: var(--p-surface-2);
  }
}

.funds-page__history-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.funds-page__history-title {
  color: var(--p-ink);
}

.funds-page__history-meta {
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
}

.funds-page__history-amount {
  white-space: nowrap;
  font-weight: 600;
}

.funds-page__more {
  display: flex;
  justify-content: center;
}

.funds-page__dialog {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
</style>
