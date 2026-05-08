<template lang="pug">
div.page-shell
  //- Поиск по «номеру»: умный input — определяет тип ID по формату.
  //- Числовой bigint (≤24 цифр) → debit.global_sequence (точечно одна проводка).
  //- 64-символьная hex-строка → process_hash (все проводки одной операции).
  //- Любая другая строка с операционными префиксами (o.cap...) — игнорируем
  //- (для этого есть реестр операций). Фильтры account_id/username прилетают
  //- через cross-link.
  q-card.q-mt-md(flat)
    q-card-section
      .row.q-gutter-sm.items-center.q-mb-sm(
        v-if='filters.accountId !== null || filters.username || filters.debitGlobalSequence || filters.applyGlobalSequence || filters.processHash'
      )
        q-chip(
          v-if='filters.accountId !== null'
          removable
          color='primary'
          text-color='white'
          icon='fa-solid fa-filter'
          @remove='clearAccountFilter'
        ) {{ accountFilterLabel }}
        q-chip(
          v-if='filters.username'
          removable
          color='primary'
          text-color='white'
          icon='fa-solid fa-user'
          @remove='clearUsernameFilter'
        ) Пайщик {{ fioCache.get(filters.username) || filters.username }}
        q-chip(
          v-if='filters.debitGlobalSequence'
          removable
          color='primary'
          text-color='white'
          icon='fa-solid fa-hashtag'
          @remove='clearIdFilter'
        ) № проводки {{ filters.debitGlobalSequence }}
        q-chip(
          v-if='filters.applyGlobalSequence'
          removable
          color='primary'
          text-color='white'
          icon='fa-solid fa-hashtag'
          @remove='clearIdFilter'
        ) № операции {{ filters.applyGlobalSequence }}
        q-chip(
          v-if='filters.processHash'
          removable
          color='primary'
          text-color='white'
          icon='fa-solid fa-hashtag'
          @remove='clearIdFilter'
        ) Процесс {{ filters.processHash.slice(0, 8) }}…
      .row.q-gutter-sm.items-end
        q-input.col-md-3.col-12(
          v-model='searchInput'
          label='Поиск (№ проводки / операции / процесса)'
          dense
          outlined
          clearable
          @keyup.enter='applySearch'
          @clear='applySearch'
        )
          template(#append)
            q-icon.cursor-pointer(name='fa-solid fa-magnifying-glass' @click='applySearch')
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
        q-btn.col-md-auto(
          v-if='hasAnyFilter'
          flat
          icon='fa-solid fa-rotate'
          label='Сбросить'
          @click='resetFilters'
        )

  //- Таблица проводок (по одной паре debit+credit на строку)
  q-card.q-mt-md(flat)
    q-table.full-height(
      flat
      :grid='isMobile'
      :rows='items'
      :columns='columns'
      row-key='key'
      :loading='loading'
      :pagination='pagination'
      :rows-per-page-options='[25, 50, 100, 200]'
      :no-data-label='"Проводки не найдены"'
      @request='onRequest'
    )
      template(#body='props')
        q-tr(:key='`pst_${props.row.key}`' :props='props')
          q-td {{ formatDate(props.row.createdAt) }}
          q-td
            EntityIdBadge(
              v-if='props.row.debitGlobalSequence'
              :rawId='props.row.debitGlobalSequence'
              @click='copyText(String(props.row.debitGlobalSequence))'
            )
              q-tooltip Клик — копировать
            span.text-grey-6(v-else) —
          q-td
            EntityIdBadge(
              v-if='props.row.processHash'
              :rawId='shortHash(props.row.processHash)'
              @click='copyFullHash(props.row.processHash)'
            )
              q-tooltip Клик — копировать полный хэш
            span.text-grey-6(v-else) —
          q-td
            q-chip(
              v-if='props.row.operationCode'
              dense
              square
              :color='processChipBg(props.row.operationCode)'
              :text-color='processChipText(props.row.operationCode)'
            ) {{ operationLabel(props.row.operationCode) }}
            span.text-grey-6(v-else) —
          q-td.text-center
            AccountIdCell(:account-code='debitCode(props.row.debitAccountId)')
          q-td.text-center
            AccountIdCell(:account-code='creditCode(props.row.creditAccountId)')
          q-td.text-right.font-monospace.text-weight-bold {{ formatAmount(props.row.quantity) }}
          q-td {{ fioCache.get(props.row.username ?? '') || props.row.username || '—' }}

          q-td.text-right(auto-width)
            q-btn(
              v-if='props.row.parentApplyGlobalSequence'
              flat dense round size='sm' color='primary'
              icon='fa-solid fa-arrow-right'
              :to='{ name: "reports-operations", query: { operation_id: props.row.parentApplyGlobalSequence } }'
            )
              q-tooltip К операции

      template(#item='props')
        .col-12
          q-card.q-pa-md.q-mb-sm
            .row.items-center.q-gutter-x-md
              .col
                .text-caption.text-grey-6 {{ formatDate(props.row.createdAt) }}
                .text-body2.text-weight-medium {{ operationLabel(props.row.operationCode) }}
              .col-auto.text-right
                .text-caption.text-grey-6 Сумма
                .text-body1.text-weight-bold.font-monospace {{ formatAmount(props.row.quantity) }}
              .col-auto
                q-btn(
                  v-if='props.row.parentApplyGlobalSequence'
                  flat dense size='sm' color='primary'
                  icon='fa-solid fa-arrow-right'
                  label='К операции'
                  :to='{ name: "reports-operations", query: { operation_id: props.row.parentApplyGlobalSequence } }'
                )
            .row.q-mt-sm.items-center.q-gutter-x-md
              .col-auto.text-caption.text-grey-7 Дебет
              .col-auto
                AccountIdCell(:account-code='debitCode(props.row.debitAccountId)')
              .col-auto.text-caption.text-grey-7 Кредит
              .col-auto
                AccountIdCell(:account-code='creditCode(props.row.creditAccountId)')
            .col-12.text-caption.text-grey-7
              | Пайщик: {{ fioCache.get(props.row.username ?? '') || props.row.username || '—' }}
            .col-12.row.q-gutter-xs.q-mt-xs.items-center
              .text-caption.text-grey-7 № проводки
              EntityIdBadge(
                v-if='props.row.debitGlobalSequence'
                :rawId='props.row.debitGlobalSequence'
                @click='copyText(String(props.row.debitGlobalSequence))'
              )
              .text-caption.text-grey-7 № процесса
              EntityIdBadge(
                v-if='props.row.processHash'
                :rawId='shortHash(props.row.processHash)'
                @click='copyFullHash(props.row.processHash)'
              )
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { copyToClipboard } from 'quasar'
import { useWindowSize } from 'src/shared/hooks'
import { useSystemStore } from 'src/entities/System/model'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { EntityIdBadge } from 'src/shared/ui'
import { useLedger2Store } from 'src/entities/Ledger2'
import type { ILedger2Posting, ILedger2PostingsFilterInput } from 'src/entities/Ledger2'
import { useAccountStore } from 'src/entities/Account'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { AccountIdCell } from '../../../shared/ui'
import { Ledger2 } from 'cooptypes'

const { info } = useSystemStore()
const { isMobile } = useWindowSize()
const route = useRoute()
const router = useRouter()
const ledger2Store = useLedger2Store()
const accountStore = useAccountStore()

// Реестр-источник: cooptypes/src/ledger2/operations.ts (LEDGER2_OPERATION_REGISTRY).
// Без локальных копий human-name'ов.
function operationLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return Ledger2.getOperationHumanName(code) ?? code
}

interface ProcessColorEntry {
  chipBg: string
  chipText: string
}
const PROCESS_COLORS: Record<string, ProcessColorEntry> = {
  reg: { chipBg: 'blue-1',        chipText: 'blue-9' },
  wal: { chipBg: 'teal-1',        chipText: 'teal-9' },
  cap: { chipBg: 'deep-purple-1', chipText: 'deep-purple-9' },
  mkt: { chipBg: 'orange-1',      chipText: 'orange-9' },
  sov: { chipBg: 'brown-1',       chipText: 'brown-9' },
  mig: { chipBg: 'grey-3',        chipText: 'grey-9' },
  adj: { chipBg: 'amber-2',       chipText: 'amber-10' },
}
const PROCESS_COLOR_DEFAULT: ProcessColorEntry = { chipBg: 'grey-3', chipText: 'grey-9' }
function processColorEntry(code: string | null | undefined): ProcessColorEntry {
  if (!code) return PROCESS_COLOR_DEFAULT
  // operation_code: `o.<contract>.<verb>` — контракт во втором сегменте.
  const parts = code.split('.')
  const contract = parts.length >= 3 ? parts[1] : parts[0]
  return PROCESS_COLORS[contract ?? ''] ?? PROCESS_COLOR_DEFAULT
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

// id хранится ×1000, к UI-коду приводим целочисленным делением — так же как
// AccountsPage / OperationsPage: 51000 → 51, 80000 → 80, 86000 → 86.
function debitCode(id: number | null | undefined): number | null {
  return id != null ? Math.round(id / 1000) : null
}
function creditCode(id: number | null | undefined): number | null {
  return id != null ? Math.round(id / 1000) : null
}

const loading = ref(false)
const items = ref<ILedger2Posting[]>([])
const fioCache = ref(new Map<string, string>())

const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 })

const filters = reactive<{
  dateFrom: string
  dateTo: string
  accountId: number | null
  accountName: string
  username: string | null
  /** debit.global_sequence — точечная адресация одной проводки. */
  debitGlobalSequence: string | null
  /** apply.global_sequence — все проводки одной apply-группы. */
  applyGlobalSequence: string | null
  /** process_hash — все проводки одной бизнес-операции (=> может быть несколько apply-групп). */
  processHash: string | null
}>({
  dateFrom: '',
  dateTo: '',
  accountId: null,
  accountName: '',
  username: null,
  debitGlobalSequence: null,
  applyGlobalSequence: null,
  processHash: null,
})

const searchInput = ref('')

/**
 * Универсальный поиск по «номеру»: определяет тип ID по формату ввода.
 * - Чистые цифры (1–24 знака) → debit.global_sequence (одна проводка).
 *   `apply.global_sequence` сюда же не попадёт — апплай и debit-номера лежат
 *   в одном пространстве global_sequence, и пользователь, как правило, видит
 *   на странице debit; поиск же по № операции — через query-parameter из реестра.
 * - 64 hex-символа → process_hash.
 * - Остальное — игнорируем (валидация падает молча, чип не появляется).
 */
function applySearch() {
  const raw = (searchInput.value ?? '').trim()
  filters.debitGlobalSequence = null
  filters.applyGlobalSequence = null
  filters.processHash = null
  if (!raw) {
    void clearIdQueryAndReload()
    return
  }
  if (/^\d{1,24}$/.test(raw)) {
    filters.debitGlobalSequence = raw
  } else if (/^[a-f0-9]{64}$/i.test(raw)) {
    filters.processHash = raw.toLowerCase()
  }
  void syncIdQueryAndReload()
}

async function syncIdQueryAndReload() {
  const q = { ...route.query }
  delete q.posting_id
  delete q.operation_id
  delete q.process_hash
  if (filters.debitGlobalSequence) q.posting_id = filters.debitGlobalSequence
  if (filters.applyGlobalSequence) q.operation_id = filters.applyGlobalSequence
  if (filters.processHash) q.process_hash = filters.processHash
  await router.replace({ query: q })
  reload()
}

async function clearIdQueryAndReload() {
  const q = { ...route.query }
  delete q.posting_id
  delete q.operation_id
  delete q.process_hash
  await router.replace({ query: q })
  reload()
}

async function clearIdFilter() {
  filters.debitGlobalSequence = null
  filters.applyGlobalSequence = null
  filters.processHash = null
  searchInput.value = ''
  await clearIdQueryAndReload()
}

async function copyText(text: string) {
  try {
    await copyToClipboard(text)
    SuccessAlert('Скопировано')
  } catch {
    FailAlert('Не удалось скопировать')
  }
}

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

const accountFilterLabel = computed(() => {
  if (filters.accountId !== null) {
    const displayCode = Math.round(filters.accountId / 1000)
    return `Счёт ${displayCode}${filters.accountName ? ` — ${filters.accountName}` : ''}`
  }
  return ''
})

async function clearAccountFilter() {
  filters.accountId = null
  filters.accountName = ''
  const q = { ...route.query }
  delete q.account_id
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
  { name: 'createdAt', align: 'left' as const, label: 'Дата', field: 'createdAt' },
  { name: 'postingId', align: 'left' as const, label: '№ проводки', field: 'debitGlobalSequence' },
  { name: 'processHash', align: 'left' as const, label: '№ процесса', field: 'processHash' },
  { name: 'operationCode', align: 'left' as const, label: 'Операция', field: 'operationCode' },
  { name: 'debit', align: 'center' as const, label: 'Дебет', field: 'debitAccountId' },
  { name: 'credit', align: 'center' as const, label: 'Кредит', field: 'creditAccountId' },
  { name: 'quantity', align: 'right' as const, label: 'Сумма', field: 'quantity' },
  { name: 'username', align: 'left' as const, label: 'Пайщик', field: 'username' },
  { name: 'actions', align: 'right' as const, label: '', field: 'parentApplyGlobalSequence', sortable: false },
]

const hasAnyFilter = computed(
  () =>
    !!filters.dateFrom ||
    !!filters.dateTo ||
    filters.accountId !== null ||
    !!filters.username ||
    !!filters.debitGlobalSequence ||
    !!filters.applyGlobalSequence ||
    !!filters.processHash,
)

async function resetFilters() {
  filters.dateFrom = ''
  filters.dateTo = ''
  filters.accountId = null
  filters.accountName = ''
  filters.username = null
  filters.debitGlobalSequence = null
  filters.applyGlobalSequence = null
  filters.processHash = null
  searchInput.value = ''
  const q = { ...route.query }
  delete q.account_id
  delete q.username
  delete q.posting_id
  delete q.operation_id
  delete q.process_hash
  await router.replace({ query: q })
  reload()
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
    const input: ILedger2PostingsFilterInput = {
      coopname: info.coopname,
      page: pagination.value.page,
      limit: pagination.value.rowsPerPage,
      sortOrder: 'DESC',
    }
    if (filters.accountId !== null) input.accountId = filters.accountId
    if (filters.username) input.username = filters.username
    if (filters.debitGlobalSequence) input.debitGlobalSequence = filters.debitGlobalSequence
    if (filters.applyGlobalSequence) input.applyGlobalSequence = filters.applyGlobalSequence
    if (filters.processHash) input.processHash = filters.processHash
    if (filters.dateFrom) input.dateFrom = new Date(filters.dateFrom)
    if (filters.dateTo) {
      const to = new Date(filters.dateTo)
      to.setHours(23, 59, 59, 999)
      input.dateTo = to
    }

    const resp = await ledger2Store.loadPostings(input)
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

async function enrichFio(rows: ILedger2Posting[]) {
  const usernames = [
    ...new Set(rows.map((o) => o.username).filter((u): u is string => !!u && !fioCache.value.has(u))),
  ]
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
      resolveAccountName(filters.accountId)
    }
    if (route.query.username) {
      filters.username = String(route.query.username)
    }
    // Унифицированные ID-параметры. Для UX в input.searchInput кладём то,
    // что пользователь, скорее всего, захочет видеть/редактировать.
    if (route.query.posting_id) {
      filters.debitGlobalSequence = String(route.query.posting_id)
      searchInput.value = filters.debitGlobalSequence
    }
    if (route.query.operation_id) {
      filters.applyGlobalSequence = String(route.query.operation_id)
    }
    if (route.query.process_hash) {
      filters.processHash = String(route.query.process_hash).toLowerCase()
      if (!searchInput.value) searchInput.value = filters.processHash
    }
    await load()
  } catch (e) {
    FailAlert(e)
  }
})
</script>

<style scoped>
.font-monospace {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 0.03em;
}
</style>
