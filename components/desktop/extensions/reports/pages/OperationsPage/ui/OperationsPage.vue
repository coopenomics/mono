<template lang="pug">
.operations-page
  //- Активные фильтры (чипы) + фильтры по датам
  q-card(flat)
    q-card-section
      .row.q-gutter-sm.items-center.q-mb-sm(
        v-if='filters.accountId !== null || filters.walletName || filters.processHash || filters.applyGlobalSequence || filters.username'
      )
        q-chip(
          v-if='filters.accountId !== null || filters.walletName'
          removable
          color='primary'
          text-color='white'
          icon='fa-solid fa-filter'
          @remove='clearAccountFilter'
        ) {{ accountFilterLabel }}
        q-chip(
          v-if='filters.applyGlobalSequence'
          removable
          color='primary'
          text-color='white'
          icon='fa-solid fa-hashtag'
          @remove='clearIdFilter'
          class='font-monospace'
        ) № операции {{ filters.applyGlobalSequence }}
        q-chip(
          v-if='filters.processHash'
          removable
          color='primary'
          text-color='white'
          icon='fa-solid fa-fingerprint'
          @remove='clearIdFilter'
          class='font-monospace'
        ) Процесс {{ filters.processHash.slice(0, 8) }}
        q-chip(
          v-if='filters.username'
          removable
          color='primary'
          text-color='white'
          icon='fa-solid fa-user'
          @remove='clearUsernameFilter'
        ) Пайщик {{ fioCache.get(filters.username) || filters.username }}
      .row.q-gutter-sm.items-end
        q-input.col-md-3.col-12(
          v-model='searchInput'
          label='Поиск (№ операции / процесса)'
          dense
          outlined
          clearable
          @clear='applyIdSearch'
          @keyup.enter='applyIdSearch'
        )
          template(#append)
            q-icon.cursor-pointer(name='fa-solid fa-magnifying-glass' @click='applyIdSearch')
        q-input.col-md-2.col-12(
          v-model='filters.dateFrom'
          label='С даты'
          dense
          outlined
          clearable
          mask='####-##-##'
          @clear='reload'
          @update:model-value='onDateFromInput'
        )
          template(#append)
            q-icon.cursor-pointer(name='event')
              q-popup-proxy(cover transition-show='scale' transition-hide='scale')
                q-date(
                  v-model='filters.dateFrom'
                  mask='YYYY-MM-DD'
                  today-btn
                  @update:model-value='reload'
                )
                  .row.items-center.justify-end
                    q-btn(v-close-popup flat label='Готово' color='primary')
        q-input.col-md-2.col-12(
          v-model='filters.dateTo'
          label='По дату'
          dense
          outlined
          clearable
          mask='####-##-##'
          @clear='reload'
          @update:model-value='onDateToInput'
        )
          template(#append)
            q-icon.cursor-pointer(name='event')
              q-popup-proxy(cover transition-show='scale' transition-hide='scale')
                q-date(
                  v-model='filters.dateTo'
                  mask='YYYY-MM-DD'
                  today-btn
                  @update:model-value='reload'
                )
                  .row.items-center.justify-end
                    q-btn(v-close-popup flat label='Готово' color='primary')
        q-toggle.col-md-auto(
          v-model='filters.adjustmentsOnly'
          label='Только корректировки'
          color='warning'
          @update:model-value='reload'
        )
        q-btn.col-md-auto(
          v-if='hasAnyFilter'
          flat
          icon='fa-solid fa-rotate'
          label='Сбросить'
          @click='resetFilters'
        )

  //- Таблица операций (только apply)
  q-card.q-mt-md(flat)
    q-table.full-height(
      flat
      :grid='isMobile'
      :rows='items'
      :columns='columns'
      row-key='globalSequence'
      :loading='loading'
      :pagination='pagination'
      :rows-per-page-options='[25, 50, 100, 200]'
      :no-data-label='"Операции не найдены"'
      @request='onRequest'
    )
      template(#body='props')
        q-tr(
          :key='`op_${props.row.globalSequence}`'
          :ref='(el) => registerRowRef(props.row.globalSequence, el)'
          :props='props'
        )
          q-td(auto-width)
            ExpandToggleButton(
              :expanded='expanded.get(props.row.globalSequence)'
              @click='toggleExpand(props.row.globalSequence, props.row.processHash)'
            )
          q-td
            EntityIdBadge(
              :rawId='props.row.globalSequence'
              @click='copyText(String(props.row.globalSequence))'
            )
              q-tooltip Клик — копировать
          q-td
            EntityIdBadge(
              v-if='props.row.processHash'
              :rawId='shortHash(props.row.processHash)'
              @click='copyFullHash(props.row.processHash)'
            )
              q-tooltip Клик — копировать полный хэш
            span.t-faint(v-else) —
          q-td {{ formatDate(props.row.createdAt) }}
          q-td
            q-chip(
              dense
              square
              :color='processChipBg(rowChipText(props.row))'
              :text-color='processChipText(rowChipText(props.row))'
            ) {{ rowLabel(props.row) }}
          q-td.text-right.font-monospace.text-weight-bold {{ formatAmount(props.row.quantity) }}
          q-td {{ fioCache.get(props.row.username ?? '') || props.row.username || '-' }}

        q-tr.q-virtual-scroll--with-prev(
          no-hover
          v-if='expanded.get(props.row.globalSequence)'
          :key='`exp_${props.row.globalSequence}`'
          :props='props'
        )
          q-td(colspan='100%')
            .q-pa-md
              //- Шапка: цветная полоска + название + action_code + ID + memo
              .op-header.q-mb-md(
                :style='{ borderLeftColor: processAccentColor(rowChipText(props.row)) }'
              )
                .text-h6.text-weight-medium {{ rowLabel(props.row) }}
                .row.items-center.q-gutter-sm.q-mb-xs(v-if='props.row.operationCode')
                  .text-caption.t-muted Тип процесса:
                  EntityIdBadge(
                    :rawId='props.row.operationCode'
                    copy-on-click
                  )
                    q-tooltip Клик — копировать
                .row.items-center.q-gutter-sm.q-mb-xs(v-if='props.row.processHash')
                  .text-caption.t-muted ID процесса:
                  EntityIdBadge(
                    :rawId='props.row.processHash'
                    copy-on-click
                  )
                    q-tooltip Клик — копировать
                .row.items-center.q-gutter-sm(v-if='props.row.memo')
                  q-icon(name='fa-solid fa-note-sticky' color='grey-6' size='xs')
                  .text-caption.t-muted {{ props.row.memo }}

              //- Тело: две таблицы рядом на md+, друг под другом на маленьких
              template(v-if='childLoading.get(props.row.globalSequence)')
                q-spinner(size='sm')
              .row.q-col-gutter-md(v-else)
                //- Таблица 1: Движения по кошелькам
                .col-12.col-md-6
                  q-card(flat bordered)
                    q-card-section.q-pb-none
                      .text-subtitle2 Движения по кошелькам
                    q-card-section.q-pt-sm
                      q-table(
                        v-if='walletRows(props.row.globalSequence).length'
                        flat dense
                        :rows='walletRows(props.row.globalSequence)'
                        :columns='walletColumns'
                        row-key='globalSequence'
                        hide-pagination
                        :pagination='{ rowsPerPage: 0 }'
                      )
                        template(#body-cell-direction='cp')
                          q-td(:props='cp')
                            DirectionCell(:direction='cp.row.direction')
                        template(#body-cell-walletFrom='cp')
                          q-td(:props='cp')
                            WalletIdCell(:wallet-name='cp.row.walletFrom')
                        template(#body-cell-walletTo='cp')
                          q-td(:props='cp')
                            WalletIdCell(:wallet-name='cp.row.walletTo')
                        template(#body-cell-quantity='cp')
                          q-td.text-right(:props='cp') {{ formatAmount(cp.row.quantity) }}
                      .text-caption.t-faint(v-else) Движений по кошелькам нет

                //- Таблица 2: Проводки по счетам (Дт → Кт парами)
                .col-12.col-md-6
                  q-card(flat bordered)
                    q-card-section.q-pb-none
                      .text-subtitle2 Проводки по счетам
                    q-card-section.q-pt-sm
                      q-table(
                        v-if='accountRows(props.row.globalSequence).length'
                        flat dense
                        :rows='accountRows(props.row.globalSequence)'
                        :columns='accountColumns'
                        row-key='key'
                        hide-pagination
                        :pagination='{ rowsPerPage: 0 }'
                      )
                        template(#body-cell-debit='cp')
                          q-td(:props='cp')
                            AccountIdCell(:account-code='cp.row.debitCode')
                        template(#body-cell-credit='cp')
                          q-td(:props='cp')
                            AccountIdCell(:account-code='cp.row.creditCode')
                        template(#body-cell-quantity='cp')
                          q-td.text-right(:props='cp') {{ formatAmount(cp.row.quantity) }}
                      .text-caption.t-faint(v-else) Проводок нет

      template(#item='props')
        .col-12
          q-card.q-pa-md.q-mb-sm
            .row.items-center.q-gutter-x-md
              .col
                .text-caption.t-faint {{ formatDate(props.row.createdAt) }}
                .text-body2.text-weight-medium {{ actionLabel(props.row.operationCode) }}
                .text-caption.t-faint.font-monospace {{ props.row.operationCode || '-' }}
              .col-auto.text-right
                .text-caption.t-faint Сумма
                .text-body1.text-weight-bold.font-monospace {{ formatAmount(props.row.quantity) }}
              .col-12.text-caption.t-muted
                | Пайщик: {{ fioCache.get(props.row.username ?? '') || props.row.username || '-' }}
              .col-12.row.q-gutter-xs.q-mt-xs.items-center
                .text-caption.t-muted № операции
                EntityIdBadge(
                  :rawId='props.row.globalSequence'
                  @click='copyText(String(props.row.globalSequence))'
                )
                .text-caption.t-muted № процесса
                EntityIdBadge(
                  v-if='props.row.processHash'
                  :rawId='shortHash(props.row.processHash)'
                  @click='copyFullHash(props.row.processHash)'
                )
</template>

<script setup lang="ts">
import { computed, onMounted, nextTick, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWindowSize } from 'src/shared/hooks'
import { useSystemStore } from 'src/entities/System/model'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton'
import { EntityIdBadge } from 'src/shared/ui'
import { copyToClipboard } from 'quasar'
import {
  useLedger2Store,
  type ILedger2Operation,
  type ILedger2HistoryFilterInput,
} from 'src/entities/Ledger2'
import { useAccountStore } from 'src/entities/Account'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { DirectionCell, WalletIdCell, AccountIdCell } from '../../../shared/ui'
import { Ledger2 } from 'cooptypes'

const { info } = useSystemStore()
const { isMobile } = useWindowSize()
const route = useRoute()
const router = useRouter()
const ledger2Store = useLedger2Store()
const accountStore = useAccountStore()

// Человекочитаемые названия операций — источник правды в
// `cooptypes/src/ledger2/operations.ts` (LEDGER2_OPERATION_REGISTRY),
// зеркалит C++-реестр `OPERATION_REGISTRY`. Никаких локальных копий.
function actionLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return Ledger2.getOperationHumanName(code) ?? code
}

/**
 * Заголовок строки реестра. У стандартных операций берём из operation_code,
 * у adjustment (walmove/revert) — operation_code в action.data не пишется,
 * поэтому используем `action`-name через тот же registry с маппингом.
 */
function rowLabel(row: ILedger2Operation): string {
  if (row.operationCode) return actionLabel(row.operationCode)
  if (row.action === 'walmove') return Ledger2.getOperationHumanName('o.adj.walmove') ?? 'Перевод между кошельками'
  if (row.action === 'revert') return Ledger2.getOperationHumanName('o.adj.rev') ?? 'Откат операции'
  return '—'
}

function rowChipText(row: ILedger2Operation): string {
  return row.operationCode ?? (row.action === 'walmove' ? 'o.adj.walmove' : row.action === 'revert' ? 'o.adj.rev' : '—')
}

// Цветовая схема по контракту-источнику operation_code — пастельный chip +
// accent-полоска. operation_code имеет формат `o.<contract>.<verb>`, контракт
// лежит во втором сегменте (parts[1]).
interface ProcessColorEntry {
  accent: string  // CSS hex/color для border-left полоски шапки
  chipBg: string  // Quasar-цвет для q-chip background (pastel)
  chipText: string  // Quasar-цвет для q-chip text-color (deep)
}
const PROCESS_COLORS: Record<string, ProcessColorEntry> = {
  reg: { accent: '#1976d2', chipBg: 'blue-1',        chipText: 'blue-9' },
  wal: { accent: '#00796b', chipBg: 'teal-1',        chipText: 'teal-9' },
  cap: { accent: '#5e35b1', chipBg: 'deep-purple-1', chipText: 'deep-purple-9' },
  mkt: { accent: '#ef6c00', chipBg: 'orange-1',      chipText: 'orange-9' },
  sov: { accent: '#5d4037', chipBg: 'brown-1',       chipText: 'brown-9' },
  mig: { accent: '#616161', chipBg: 'grey-3',        chipText: 'grey-9' },
  // adjustment (ручные корректировки председателя — выделяем янтарным,
  // чтобы выглядели иначе чем штатные операции).
  adj: { accent: '#ef6c00', chipBg: 'amber-2',       chipText: 'amber-10' },
}
const PROCESS_COLOR_DEFAULT: ProcessColorEntry = {
  accent: '#9e9e9e', chipBg: 'grey-3', chipText: 'grey-9',
}
function processColorEntry(code: string | null | undefined): ProcessColorEntry {
  if (!code) return PROCESS_COLOR_DEFAULT
  const parts = code.split('.')
  const contract = parts.length >= 3 ? parts[1] : parts[0]
  return PROCESS_COLORS[contract ?? ''] ?? PROCESS_COLOR_DEFAULT
}
function processAccentColor(code: string | null | undefined): string {
  return processColorEntry(code).accent
}
function processChipBg(code: string | null | undefined): string {
  return processColorEntry(code).chipBg
}
function processChipText(code: string | null | undefined): string {
  return processColorEntry(code).chipText
}

function shortHash(hash: string | null | undefined): string {
  if (!hash) return '—'
  return hash.slice(0, 8)
}

async function copyFullHash(hash: string | null | undefined) {
  if (!hash) return
  try {
    await copyToClipboard(hash)
    SuccessAlert('Скопировано')
  } catch {
    FailAlert('Не удалось скопировать')
  }
}

function formatAmount(qty: string | null | undefined): string {
  if (!qty) return '—'
  return formatAsset2Digits(qty)
}

const loading = ref(false)
const items = ref<ILedger2Operation[]>([])
const expanded = ref(new Map<string, boolean>())
const rowRefs = new Map<string, HTMLElement | null>()

// FIO-кэш: username → ФИО
const fioCache = ref(new Map<string, string>())

// Дочерние операции для развёрнутого apply
const childOps = ref(new Map<string, ILedger2Operation[]>())
const childLoading = ref(new Map<string, boolean>())

function registerRowRef(seq: string, el: unknown): void {
  if (el && typeof (el as { $el?: HTMLElement }).$el !== 'undefined') {
    rowRefs.set(String(seq), (el as { $el: HTMLElement }).$el)
  } else if (el instanceof HTMLElement) {
    rowRefs.set(String(seq), el)
  } else if (el === null) {
    rowRefs.delete(String(seq))
  }
}

const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 })

const filters = reactive<{
  dateFrom: string
  dateTo: string
  /** Бух.счёт (×1000): 51000/80000/86000 — для фильтра по debit/credit. */
  accountId: number | null
  /** eosio::name кошелька (`w.<contract>.<waltype>`) — для фильтра по walletop. */
  walletName: string | null
  accountKind: 'wallet' | 'account' | null
  accountName: string
  /** process_hash — все apply одной бизнес-операции (multi-effect ⇒ может быть несколько). */
  processHash: string | null
  /** № операции = apply.global_sequence — точечная адресация одного apply (вместе с siblings). */
  applyGlobalSequence: string | null
  username: string | null
  adjustmentsOnly: boolean
}>({
  dateFrom: '',
  dateTo: '',
  accountId: null,
  walletName: null,
  accountKind: null,
  accountName: '',
  processHash: null,
  applyGlobalSequence: null,
  username: null,
  adjustmentsOnly: false,
})

const searchInput = ref('')

/**
 * Применяет search-input по process_hash к фильтру.
 * Backend ожидает полный hex (data->>'process_hash' = $); если введён короткий
 * фрагмент — нормализуем к lower-case полному hash через подстроку, иначе
 * apply ровно как ввёл (полное совпадение).
 */
/**
 * Поля «С даты» / «По дату» свободно редактируемые (mask `####-##-##`),
 * но reload запускаем только когда дата полная — иначе фильтр срабатывает
 * на каждую цифру и мигает индикатор загрузки.
 */
function isCompleteOrEmptyDate(v: string | number | null): boolean {
  if (v === null || v === '') return true
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

function onDateFromInput(value: string | number | null): void {
  if (isCompleteOrEmptyDate(value)) reload()
}
function onDateToInput(value: string | number | null): void {
  if (isCompleteOrEmptyDate(value)) reload()
}

/**
 * Универсальный поиск: input принимает либо `apply.global_sequence` (цифры),
 * либо `process_hash` (hex64). По формату определяет тип и кладёт в нужный
 * фильтр. Любая другая строка — игнор (валидация молчком, чип не появляется).
 */
async function applyIdSearch(): Promise<void> {
  const raw = (searchInput.value ?? '').trim()
  filters.applyGlobalSequence = null
  filters.processHash = null
  if (raw) {
    if (/^\d{1,24}$/.test(raw)) {
      filters.applyGlobalSequence = raw
    } else if (/^[a-f0-9]{64}$/i.test(raw)) {
      filters.processHash = raw.toLowerCase()
    }
  }
  const q = { ...route.query }
  delete q.process_hash
  delete q.operation_id
  if (filters.applyGlobalSequence) q.operation_id = filters.applyGlobalSequence
  if (filters.processHash) q.process_hash = filters.processHash
  await router.replace({ query: q })
  reload()
}

async function copyText(text: string) {
  try {
    await copyToClipboard(text)
    SuccessAlert('Скопировано')
  } catch {
    FailAlert('Не удалось скопировать')
  }
}


const accountFilterLabel = computed(() => {
  if (filters.accountKind === 'wallet' && filters.walletName) {
    return `Кошелёк ${filters.walletName}${filters.accountName ? ` — ${filters.accountName}` : ''}`
  }
  if (filters.accountId !== null) {
    const displayCode = Math.round(filters.accountId / 1000)
    return `Счёт ${displayCode}${filters.accountName ? ` — ${filters.accountName}` : ''}`
  }
  return ''
})

async function clearAccountFilter() {
  filters.accountId = null
  filters.walletName = null
  filters.accountKind = null
  filters.accountName = ''
  const q = { ...route.query }
  delete q.wallet_name
  delete q.wallet_id
  delete q.account_id
  await router.replace({ query: q })
  reload()
}

async function clearIdFilter() {
  filters.processHash = null
  filters.applyGlobalSequence = null
  searchInput.value = ''
  const q = { ...route.query }
  delete q.process_hash
  delete q.operation_id
  await router.replace({ query: q })
  reload()
}

async function clearUsernameFilter() {
  filters.username = null
  const q = { ...route.query }
  delete q.username
  await router.replace({ query: q })
  reload()
}

async function resolveWalletName(walletName: string) {
  try {
    const wallets = await ledger2Store.loadWallets(info.coopname)
    const w = wallets.find((x) => x.id === walletName)
    if (w) filters.accountName = w.name
  } catch {
    // молча — chip покажется без названия
  }
}

async function resolveAccountName(id: number) {
  try {
    const accounts = await ledger2Store.loadAccounts(info.coopname)
    const a = accounts.find((x) => x.id === id)
    if (a) filters.accountName = a.name
  } catch {
    // молча — chip покажется без названия
  }
}

const columns = [
  { name: 'expand', align: 'left' as const, label: '', field: 'expand', sortable: false },
  { name: 'operationId', align: 'left' as const, label: '№ операции', field: 'globalSequence' },
  { name: 'processHash', align: 'left' as const, label: '№ процесса', field: 'processHash' },
  { name: 'createdAt', align: 'left' as const, label: 'Дата', field: 'createdAt' },
  { name: 'actionName', align: 'left' as const, label: 'Операция', field: 'operationCode' },
  { name: 'quantity', align: 'right' as const, label: 'Сумма', field: 'quantity' },
  { name: 'username', align: 'left' as const, label: 'Пайщик', field: 'username' },
]

const walletColumns = [
  { name: 'direction', align: 'center' as const, label: '', field: 'direction' },
  { name: 'walletFrom', align: 'left' as const, label: 'Из', field: 'walletFrom' },
  { name: 'walletTo', align: 'left' as const, label: 'В', field: 'walletTo' },
  { name: 'quantity', align: 'right' as const, label: 'Сумма', field: 'quantity' },
]

const accountColumns = [
  { name: 'debit', align: 'center' as const, label: 'Дебет', field: 'debit' },
  { name: 'credit', align: 'center' as const, label: 'Кредит', field: 'credit' },
  { name: 'quantity', align: 'right' as const, label: 'Сумма', field: 'quantity' },
]

// Группированные sibling-операции по parent apply globalSequence
interface WalletRow {
  globalSequence: string
  direction: 'in' | 'out' | 'move'
  /** eosio::name кошелька (`w.<contract>.<waltype>`) или null. */
  walletFrom: string | null
  walletTo: string | null
  quantity: string | null
}
interface AccountRow {
  key: string
  debitCode: number | null
  creditCode: number | null
  quantity: string | null
}

function walletRows(parentSeq: string): WalletRow[] {
  const ops = childOps.value.get(parentSeq) ?? []
  return ops
    .filter((o) => o.action === 'walletop')
    .map((o) => {
      const from = o.walletFrom ?? null
      const to = o.walletTo ?? null
      let direction: WalletRow['direction'] = 'move'
      if (from && !to) direction = 'out'
      else if (!from && to) direction = 'in'
      return {
        globalSequence: String(o.globalSequence),
        direction,
        walletFrom: from,
        walletTo: to,
        quantity: o.quantity ?? null,
      }
    })
}

function accountRows(parentSeq: string): AccountRow[] {
  const ops = childOps.value.get(parentSeq) ?? []
  const debit = ops.find((o) => o.action === 'debit')
  const credit = ops.find((o) => o.action === 'credit')
  if (!debit && !credit) return []
  return [
    {
      key: `${parentSeq}_pair`,
      debitCode: debit?.accountId != null ? Math.round(debit.accountId / 1000) : null,
      creditCode: credit?.accountId != null ? Math.round(credit.accountId / 1000) : null,
      quantity: debit?.quantity ?? credit?.quantity ?? null,
    },
  ]
}

const hasAnyFilter = computed(
  () =>
    !!filters.dateFrom ||
    !!filters.dateTo ||
    filters.accountId !== null ||
    !!filters.walletName ||
    !!filters.processHash ||
    !!filters.applyGlobalSequence ||
    !!filters.username ||
    filters.adjustmentsOnly,
)

async function resetFilters() {
  filters.dateFrom = ''
  filters.dateTo = ''
  filters.accountId = null
  filters.walletName = null
  filters.accountKind = null
  filters.accountName = ''
  filters.processHash = null
  filters.applyGlobalSequence = null
  searchInput.value = ''
  filters.username = null
  filters.adjustmentsOnly = false
  const q = { ...route.query }
  delete q.wallet_name
  delete q.wallet_id
  delete q.account_id
  delete q.process_hash
  delete q.operation_id
  delete q.username
  await router.replace({ query: q })
  reload()
}

function toggleExpand(seq: string, processHash: string | null | undefined) {
  const wasOpen = expanded.value.get(seq)
  expanded.value.set(seq, !wasOpen)
  if (!wasOpen && processHash && !childOps.value.has(seq)) {
    loadChildOps(seq, processHash)
  }
}

async function loadChildOps(seq: string, processHash: string) {
  childLoading.value.set(seq, true)
  try {
    const resp = await ledger2Store.loadHistory({
      coopname: info.coopname,
      processHash,
      parentApplyGlobalSequence: seq,
      actionNames: ['walletop', 'debit', 'credit'],
      limit: 10,
      sortOrder: 'ASC',
    })
    childOps.value.set(seq, resp?.items ?? [])
  } catch (e) {
    FailAlert(e)
  } finally {
    childLoading.value.set(seq, false)
  }
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

let lastRequestId = 0

async function reload() {
  pagination.value.page = 1
  await load()
}

async function load() {
  const myId = ++lastRequestId
  loading.value = true
  try {
    const input: ILedger2HistoryFilterInput = {
      coopname: info.coopname,
      // Adjustment-операции (walmove/revert) — top-level actions, не «apply».
      // По умолчанию показываем всё: стандартные apply + корректировки.
      // При включённом «Только корректировки» — оставляем только их.
      actionNames: filters.adjustmentsOnly ? ['walmove', 'revert'] : ['apply', 'walmove', 'revert'],
      page: pagination.value.page,
      limit: pagination.value.rowsPerPage,
      sortOrder: 'DESC',
    }
    // operation_code в data adjustment-action нет (walmove/revert получают
    // process_hash, но не operation_code как payload-поле). Поэтому фильтр
    // «Только корректировки» работает через actionNames=[walmove,revert].
    if (filters.accountId !== null) input.accountId = filters.accountId
    if (filters.walletName) input.walletName = filters.walletName
    if (filters.processHash) input.processHash = filters.processHash
    if (filters.applyGlobalSequence) input.applyGlobalSequence = filters.applyGlobalSequence
    if (filters.username) input.username = filters.username
    if (filters.dateFrom) input.dateFrom = new Date(filters.dateFrom)
    if (filters.dateTo) {
      const to = new Date(filters.dateTo)
      to.setHours(23, 59, 59, 999)
      input.dateTo = to
    }

    const resp = await ledger2Store.loadHistory(input)
    if (myId !== lastRequestId) return
    if (resp) {
      items.value = resp.items
      pagination.value.rowsNumber = resp.totalCount
      enrichFio(resp.items)
    }
  } catch (e) {
    if (myId === lastRequestId) FailAlert(e)
  } finally {
    if (myId === lastRequestId) loading.value = false
  }
}

function onRequest(props: { pagination: { page: number; rowsPerPage: number; rowsNumber?: number } }) {
  pagination.value = {
    page: props.pagination.page,
    rowsPerPage: props.pagination.rowsPerPage,
    rowsNumber: props.pagination.rowsNumber ?? pagination.value.rowsNumber,
  }
  load()
}

async function enrichFio(ops: ILedger2Operation[]) {
  const usernames = [...new Set(ops.map((o) => o.username).filter((u): u is string => !!u && !fioCache.value.has(u)))]
  if (!usernames.length) return
  await Promise.allSettled(
    usernames.map(async (username) => {
      try {
        const acc = await accountStore.getAccount(username)
        const pd = acc?.private_account
        if (!pd) return
        let fio = ''
        if (pd.type === 'individual' && pd.individual_data) {
          const d = pd.individual_data
          fio = [d.last_name, d.first_name, d.middle_name].filter(Boolean).join(' ')
        } else if (pd.type === 'organization' && pd.organization_data) {
          fio = (pd.organization_data as any).short_name ?? username
        } else if (pd.type === 'entrepreneur' && pd.entrepreneur_data) {
          const d = pd.entrepreneur_data as any
          fio = [d.last_name, d.first_name, d.middle_name].filter(Boolean).join(' ')
        }
        if (fio) fioCache.value.set(username, fio)
      } catch {
        // молча — username остаётся как fallback
      }
    }),
  )
}

onMounted(async () => {
  try {
    if (route.query.account_id) {
      filters.accountId = Number(route.query.account_id)
      filters.accountKind = 'account'
      resolveAccountName(filters.accountId)
    } else if (route.query.wallet_name) {
      filters.walletName = String(route.query.wallet_name)
      filters.accountKind = 'wallet'
      resolveWalletName(filters.walletName)
    }
    if (route.query.process_hash) {
      filters.processHash = String(route.query.process_hash).toLowerCase()
      searchInput.value = filters.processHash
    }
    if (route.query.operation_id) {
      // ?operation_id = № операции (apply.global_sequence). Фильтруем выборку
      // по этому ID — на странице остаётся ровно одна (или строго ограниченная)
      // строка, после load() она автоматически разворачивается.
      filters.applyGlobalSequence = String(route.query.operation_id)
      // Если в input ещё пусто — кладём № операции, чтобы пользователь видел
      // то, что отфильтровано, и мог редактировать поиск.
      if (!searchInput.value) searchInput.value = filters.applyGlobalSequence
    }
    if (route.query.username) {
      filters.username = String(route.query.username)
    }
    await load()

    if (filters.applyGlobalSequence) {
      const seq = filters.applyGlobalSequence
      const row = items.value.find((r) => String(r.globalSequence) === seq)
      expanded.value.set(seq, true)
      if (row?.processHash) {
        loadChildOps(seq, row.processHash)
      }
      nextTick(() => {
        rowRefs.get(seq)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  } catch (e) {
    FailAlert(e)
  }
})
</script>

<style scoped>
.operations-page {
  padding: var(--p-6, 24px);
}
@media (max-width: 768px) {
  .operations-page { padding: var(--p-4, 16px); }
}
.font-monospace {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 0.03em;
}
.op-header {
  border-left: 4px solid var(--p-line-2);
  padding: 4px 0 4px 12px;
}
</style>
