<template lang="pug">
//- Фонды кооператива на кошельках учётной книги (задача 99D-24). Кошелёк и есть
//- субсчёт фонда: остаток — остаток кошелька, обороты и история — операции
//- учётной книги, у которых кошелёк фонда стоит источником или получателем.
div.funds-page
  .funds-page__toolbar
    .funds-page__period
      BaseInput(
        v-model='dateFrom'
        type='date'
        :label='$t("reports.fundsPage.periodFromLabel")'
      )
      BaseInput(
        v-model='dateTo'
        type='date'
        :label='$t("reports.fundsPage.periodToLabel")'
      )
    .funds-page__summary
      .t-muted {{ $t('reports.fundsPage.percentSumLine', { sum: percentSumLabel }) }}
      .t-faint {{ $t('reports.fundsPage.percentHint') }}

  BaseTable(
    :columns='columns'
    :rows='funds'
    row-key='id'
    :loading='loading'
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

  //- Вложения «Благороста» — справка, не фонд: расходы программы идут со счёта
  //- вложений (08), а не из целевого финансирования (вопрос бухгалтеру BB1-2).
  .funds-page__investments(v-if='investments')
    .funds-page__investments-head
      .t-muted {{ $t('reports.fundsPage.investmentsTitle') }}
      .t-faint {{ $t('reports.fundsPage.investmentsHint') }}
    .funds-page__investments-row
      WalletIdCell(:wallet-name='investments.wallet')
      span {{ investments.wallet_name }}
      span.funds-page__num {{ formatAsset2Digits(investments.available) }}
      span.funds-page__num.t-muted {{ $t('reports.fundsPage.turnoverLine', { income: formatAsset2Digits(investments.income), outcome: formatAsset2Digits(investments.outcome) }) }}

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
          BaseTable(
            v-if='movements.length || historyLoading'
            :columns='historyColumns'
            :rows='movements'
            row-key='global_sequence'
            :loading='historyLoading'
            :skeleton-rows='4'
          )
            template(#cell-amount='{ row }')
              span.funds-page__num(:class='row.direction === IN ? "funds-page__in" : "funds-page__out"') {{ formatAsset2Digits(row.amount) }}
            template(#cell-counterparty='{ row }')
              WalletIdCell(:wallet-name='row.counterparty_wallet')
            template(#cell-process='{ row }')
              BaseButton(
                v-if='row.process_hash'
                variant='ghost'
                size='sm'
                @click='toProcess(row)'
              ) {{ $t('reports.fundsPage.toProcessLabel') }}
              span.t-faint(v-else) —
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
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { FundContract } from 'cooptypes'
import { Zeus } from '@coopenomics/sdk'
import { useLiveReload, liveTable } from 'src/shared/lib/realtime'
import { useSystemStore } from 'src/entities/System/model'
import { useSessionStore } from 'src/entities/Session/model'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { BaseButton, BaseChip, BaseDialog, BaseInput, BaseTable, EmptyState } from 'src/shared/ui/base'
import type { BaseTableColumn } from 'src/shared/ui/base'
import { DataRow, DetailsDrawer } from 'src/shared/ui/domain'
import { LEDGER_LIVE_TABLES } from 'app/extensions/reports/shared/lib/live'
import {
  editDeskFund,
  loadDeskFundHistory,
  loadDeskFunds,
  type IDeskFund,
  type IDeskFundMovement,
} from 'app/extensions/reports/shared/lib/registries'
import { WalletIdCell } from '../../../shared/ui'
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
const funds = ref<IDeskFund[]>([])
const investments = ref<IDeskFund | null>(null)
const percentSum = ref(0)
const dateFrom = ref('')
const dateTo = ref('')

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
const percentSumLabel = computed(() => percentLabel(percentSum.value))

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

const historyColumns: BaseTableColumn<IDeskFundMovement>[] = [
  { key: 'created_at', label: t('reports.fundsPage.history.date'), field: (row) => formatDate(row.created_at), nowrap: true },
  { key: 'operation_name', label: t('reports.fundsPage.history.operation'), field: 'operation_name' },
  { key: 'amount', label: t('reports.fundsPage.history.amount'), align: 'right', numeric: true },
  { key: 'counterparty', label: t('reports.fundsPage.history.counterparty') },
  { key: 'process', label: '', align: 'right' },
]

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
  return {
    coopname: info.coopname,
    date_from: dateFrom.value ? new Date(`${dateFrom.value}T00:00:00`) : undefined,
    date_to: dateTo.value ? new Date(`${dateTo.value}T23:59:59`) : undefined,
  }
}

async function load(): Promise<void> {
  try {
    const registry = await loadDeskFunds(periodInput())
    funds.value = registry.funds
    investments.value = registry.investments ?? null
    percentSum.value = Number(registry.percent_sum)
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

watch([dateFrom, dateTo], () => {
  void load()
  if (drawerOpen.value) void loadHistory(1)
})

onMounted(load)
useLiveReload(FUNDS_LIVE_TABLES, async () => {
  await load()
  if (drawerOpen.value) await loadHistory(1)
})
</script>

<style scoped lang="scss">
.funds-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

.funds-page__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--p-4);
}

.funds-page__period {
  display: flex;
  gap: var(--p-3);
}

.funds-page__summary {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  max-width: 48ch;
}

.funds-page__investments {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  padding: var(--p-3) var(--p-4);
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.funds-page__investments-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-4);
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
