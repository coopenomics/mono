<template lang="pug">
div.page-shell
  q-card.q-mt-md(flat)
    q-card-section
      .row.q-gutter-sm.items-center.q-mb-sm(v-if='filters.processType || filters.username || filters.processHash')
        q-chip(
          v-if='filters.processType'
          removable
          color='primary'
          text-color='white'
          icon='fa-solid fa-gears'
          @remove='clearProcessTypeFilter'
        ) {{ processTypeLabel(filters.processType) }}
        q-chip(
          v-if='filters.username'
          removable
          color='primary'
          text-color='white'
          icon='fa-solid fa-user'
          @remove='clearUsernameFilter'
        ) Пайщик {{ fioCache.get(filters.username) || filters.username }}
        q-chip(
          v-if='filters.processHash'
          removable
          color='primary'
          text-color='white'
          icon='fa-solid fa-fingerprint'
          class='font-monospace'
          @remove='clearProcessHashFilter'
        ) Процесс {{ filters.processHash.slice(0, 8) }}
      .row.q-gutter-sm.items-end
        q-select.col-md-4.col-12(
          v-model='filters.processType'
          :options='processTypeOptions'
          option-value='type'
          option-label='label'
          emit-value
          map-options
          dense
          outlined
          clearable
          label='Тип процесса'
          @update:model-value='reload'
        )
        q-input.col-md-3.col-12(
          v-model='usernameInput'
          label='Поиск (пайщик)'
          dense
          outlined
          clearable
          @clear='applyUsernameFilter'
          @keyup.enter='applyUsernameFilter'
        )
          template(#append)
            q-icon.cursor-pointer(name='fa-solid fa-magnifying-glass' @click='applyUsernameFilter')
        q-btn.col-md-auto(
          v-if='hasAnyFilter'
          flat
          icon='fa-solid fa-rotate'
          label='Сбросить'
          @click='resetFilters'
        )

  q-card.q-mt-md(flat)
    q-table.full-height(
      flat
      :grid='isMobile'
      :rows='items'
      :columns='columns'
      row-key='processHash'
      :loading='loading'
      :pagination='pagination'
      :rows-per-page-options='[25, 50, 100, 200]'
      :no-data-label='"Процессы не найдены"'
      @request='onRequest'
    )
      template(#body='props')
        q-tr(:key='`proc_${props.row.processHash}`' :props='props')
          q-td(auto-width)
            ExpandToggleButton(
              :expanded='expanded.get(props.row.processHash)'
              @click='toggleExpand(props.row.processHash)'
            )
          q-td
            q-chip(
              dense
              square
              :color='processChipBg(props.row.processType)'
              :text-color='processChipText(props.row.processType)'
            ) {{ processTypeLabel(props.row.processType) }}
          q-td
            EntityIdBadge(
              :rawId='shortHash(props.row.processHash)'
              @click='copyText(props.row.processHash)'
            )
              q-tooltip Клик — копировать полный хэш
          q-td {{ fioCache.get(props.row.username ?? '') || props.row.username || '—' }}
          q-td {{ formatDate(props.row.firstSeenAt) }}
          q-td {{ formatDate(props.row.lastSeenAt) }}

        q-tr.q-virtual-scroll--with-prev(
          no-hover
          v-if='expanded.get(props.row.processHash)'
          :key='`exp_${props.row.processHash}`'
          :props='props'
        )
          q-td(colspan='100%')
            .q-pa-md
              .op-header.q-mb-md(
                :style='{ borderLeftColor: processAccentColor(props.row.processType) }'
              )
                .text-h6.text-weight-medium {{ processTypeLabel(props.row.processType) }}
                .row.items-center.q-gutter-sm.q-mb-xs
                  .text-caption.text-grey-7 ID процесса:
                  EntityIdBadge(:rawId='props.row.processHash' copy-on-click)

              template(v-if='!detailLoaded.has(props.row.processHash)')
                q-spinner(size='sm')
              template(v-else)
                //- Документы процесса (наименование / дата / подписанты),
                //- открытие и скачивание — на странице самого документа.
                q-card.q-mb-md(flat bordered)
                  q-card-section.q-pb-none
                    .text-subtitle2 Документы
                  q-card-section.q-pt-sm
                    .text-body2.text-grey-7(v-if='!processDocs(props.row.processHash).length') Документы не приложены
                    .column.q-gutter-xs(v-else)
                      DocumentRow(
                        v-for='d in processDocs(props.row.processHash)'
                        :key='docHash(d)'
                        :document='toDocRow(d)'
                        @open='openDoc(d)'
                      )

                .row.q-col-gutter-md
                  //- Операции процесса (apply + корректировки)
                  .col-12.col-md-6
                    q-card(flat bordered)
                      q-card-section.q-pb-none
                        .text-subtitle2 Операции
                      q-card-section.q-pt-sm
                        .text-body2.text-grey-7(v-if='!processOps(props.row.processHash).length') Операций нет
                        q-table(
                          v-else
                          flat dense
                          :rows='processOps(props.row.processHash)'
                          :columns='opColumns'
                          row-key='globalSequence'
                          hide-pagination
                          :pagination='{ rowsPerPage: 0 }'
                        )
                          template(#body-cell-date='cp')
                            q-td(:props='cp') {{ formatDate(cp.row.createdAt) }}
                          template(#body-cell-op='cp')
                            q-td(:props='cp')
                              EntityIdBadge(
                                :rawId='cp.row.globalSequence'
                                @click='goToOperation(cp.row.globalSequence)'
                              )
                                q-tooltip Открыть в реестре операций
                          template(#body-cell-label='cp')
                            q-td(:props='cp')
                              q-chip(
                                dense square
                                :color='processChipBg(props.row.processType)'
                                :text-color='processChipText(props.row.processType)'
                              ) {{ opLabel(cp.row) }}
                          template(#body-cell-amount='cp')
                            q-td.text-right.font-monospace(:props='cp') {{ formatAmount(cp.row.quantity) }}

                  //- Проводки процесса (Дт → Кт парами)
                  .col-12.col-md-6
                    q-card(flat bordered)
                      q-card-section.q-pb-none
                        .text-subtitle2 Проводки
                      q-card-section.q-pt-sm
                        .text-body2.text-grey-7(v-if='!processPostings(props.row.processHash).length') Проводок нет
                        q-table(
                          v-else
                          flat dense
                          :rows='processPostings(props.row.processHash)'
                          :columns='pstColumns'
                          row-key='key'
                          hide-pagination
                          :pagination='{ rowsPerPage: 0 }'
                        )
                          template(#body-cell-date='cp')
                            q-td(:props='cp') {{ formatDate(cp.row.createdAt) }}
                          template(#body-cell-posting='cp')
                            q-td(:props='cp')
                              EntityIdBadge(
                                v-if='cp.row.debitGlobalSequence'
                                :rawId='cp.row.debitGlobalSequence'
                                @click='goToPosting(cp.row.debitGlobalSequence)'
                              )
                                q-tooltip Открыть в реестре проводок
                              span.text-grey-6(v-else) —
                          template(#body-cell-debit='cp')
                            q-td.text-center(:props='cp')
                              AccountIdCell(:account-code='accCode(cp.row.debitAccountId)')
                          template(#body-cell-credit='cp')
                            q-td.text-center(:props='cp')
                              AccountIdCell(:account-code='accCode(cp.row.creditAccountId)')
                          template(#body-cell-amount='cp')
                            q-td.text-right.font-monospace(:props='cp') {{ formatAmount(cp.row.quantity) }}

      template(#item='props')
        .col-12
          q-card.q-pa-md.q-mb-sm
            .row.items-center.q-gutter-x-md
              .col
                .text-caption.text-grey-6 {{ formatDate(props.row.lastSeenAt) }}
                .text-body2.text-weight-medium {{ processTypeLabel(props.row.processType) }}
              .col-12.text-caption.text-grey-7
                | Пайщик: {{ fioCache.get(props.row.username ?? '') || props.row.username || '—' }}
              .col-12.row.q-gutter-xs.q-mt-xs.items-center
                .text-caption.text-grey-7 ID процесса
                EntityIdBadge(
                  :rawId='shortHash(props.row.processHash)'
                  @click='copyText(props.row.processHash)'
                )

  //- Просмотр документа процесса во всплывающем окне (без перехода в реестр
  //- документов совета — у бухгалтера может не быть к нему доступа).
  DocumentViewerDialog(
    v-model='viewerOpen'
    :document-aggregate='viewerDoc'
    :title='viewerTitle'
  )
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWindowSize } from 'src/shared/hooks'
import { useSystemStore } from 'src/entities/System/model'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton'
import { EntityIdBadge } from 'src/shared/ui'
import { copyToClipboard } from 'quasar'
import {
  useProcessStore,
  type IProcessSummary,
  type IProcessView,
  type IProcessDocument,
} from 'src/entities/Process'
import {
  useLedger2Store,
  type ILedger2Operation,
  type ILedger2Posting,
} from 'src/entities/Ledger2'
import { useAccountStore } from 'src/entities/Account'
import type { IDocumentAggregate } from 'src/entities/Document/model'
import { DocumentRow, type DocumentRowDoc } from 'src/shared/ui/domain/DocumentRow'
import { DocumentViewerDialog } from 'src/shared/ui/domain/DocumentViewerDialog'
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { AccountIdCell } from '../../../shared/ui'
import { Ledger2 } from 'cooptypes'

const { info } = useSystemStore()
const { isMobile } = useWindowSize()
const route = useRoute()
const router = useRouter()
const processStore = useProcessStore()
const ledger2Store = useLedger2Store()
const accountStore = useAccountStore()

// Просмотр документа во всплывающем окне (агрегат уже загружен в getProcess).
const viewerOpen = ref(false)
const viewerDoc = ref<IDocumentAggregate | null>(null)
const viewerTitle = ref('')

const loading = ref(false)
const items = ref<IProcessSummary[]>([])
const expanded = ref(new Map<string, boolean>())
const fioCache = ref(new Map<string, string>())
const detailLoaded = ref(new Set<string>())
const processDetails = ref(new Map<string, IProcessView>())
const procOpsMap = ref(new Map<string, ILedger2Operation[]>())
const procPostingsMap = ref(new Map<string, ILedger2Posting[]>())

const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 })

const filters = reactive<{
  processType: string | null
  username: string | null
  /** process_hash — точечная адресация одного процесса (deep-link из операций/проводок). */
  processHash: string | null
}>({
  processType: null,
  username: null,
  processHash: null,
})

const usernameInput = ref('')

const processTypeOptions = computed(() =>
  Ledger2.LEDGER2_PROCESS_REGISTRY.map((p) => ({
    type: p.type,
    label: p.human_name,
  })),
)

function processTypeLabel(type: string | null | undefined): string {
  if (!type) return '—'
  return Ledger2.getProcessHumanName(type) ?? type
}

// Человекочитаемое название операции (apply). Корректировки walmove/revert
// не несут operation_code — берём название по action через тот же реестр.
function opLabel(row: ILedger2Operation): string {
  if (row.operationCode) return Ledger2.getOperationHumanName(row.operationCode) ?? row.operationCode
  if (row.action === 'walmove') return Ledger2.getOperationHumanName('o.adj.walmove') ?? 'Перевод между кошельками'
  if (row.action === 'revert') return Ledger2.getOperationHumanName('o.adj.rev') ?? 'Откат операции'
  return '—'
}

interface ProcessColorEntry {
  accent: string
  chipBg: string
  chipText: string
}
const PROCESS_COLORS: Record<string, ProcessColorEntry> = {
  reg: { accent: '#1976d2', chipBg: 'blue-1',        chipText: 'blue-9' },
  wal: { accent: '#00796b', chipBg: 'teal-1',        chipText: 'teal-9' },
  cap: { accent: '#5e35b1', chipBg: 'deep-purple-1', chipText: 'deep-purple-9' },
  mkt: { accent: '#ef6c00', chipBg: 'orange-1',      chipText: 'orange-9' },
  sov: { accent: '#5d4037', chipBg: 'brown-1',       chipText: 'brown-9' },
  mig: { accent: '#616161', chipBg: 'grey-3',        chipText: 'grey-9' },
  adj: { accent: '#ef6c00', chipBg: 'amber-2',       chipText: 'amber-10' },
}
const PROCESS_COLOR_DEFAULT: ProcessColorEntry = {
  accent: '#9e9e9e', chipBg: 'grey-3', chipText: 'grey-9',
}
function processColorEntry(type: string | null | undefined): ProcessColorEntry {
  if (!type) return PROCESS_COLOR_DEFAULT
  const parts = type.split('.')
  const contract = parts.length >= 3 ? parts[1] : parts[0]
  return PROCESS_COLORS[contract ?? ''] ?? PROCESS_COLOR_DEFAULT
}
function processAccentColor(type: string | null | undefined): string {
  return processColorEntry(type).accent
}
function processChipBg(type: string | null | undefined): string {
  return processColorEntry(type).chipBg
}
function processChipText(type: string | null | undefined): string {
  return processColorEntry(type).chipText
}

function shortHash(hash: string | null | undefined): string {
  if (!hash) return '—'
  return hash.slice(0, 8)
}

async function copyText(text: string | null | undefined) {
  if (!text) return
  try {
    await copyToClipboard(text)
    SuccessAlert('Скопировано')
  } catch {
    FailAlert('Не удалось скопировать')
  }
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatAmount(qty: string | null | undefined): string {
  if (!qty) return '—'
  return formatAsset2Digits(qty)
}

// id счёта хранится ×1000 — к UI-коду приводим целочисленным делением (51000 → 51).
function accCode(id: number | null | undefined): number | null {
  return id != null ? Math.round(id / 1000) : null
}

const hasAnyFilter = computed(
  () => !!filters.processType || !!filters.username || !!filters.processHash,
)

const columns = [
  { name: 'expand', align: 'left' as const, label: '', field: 'expand', sortable: false },
  { name: 'processType', align: 'left' as const, label: 'Тип процесса', field: 'processType' },
  { name: 'processHash', align: 'left' as const, label: 'ID процесса', field: 'processHash' },
  { name: 'username', align: 'left' as const, label: 'Пайщик', field: 'username' },
  { name: 'firstSeenAt', align: 'left' as const, label: 'Создан', field: 'firstSeenAt' },
  { name: 'lastSeenAt', align: 'left' as const, label: 'Последнее событие', field: 'lastSeenAt' },
]

const opColumns = [
  { name: 'date', align: 'left' as const, label: 'Дата', field: 'createdAt' },
  { name: 'op', align: 'left' as const, label: '№ операции', field: 'globalSequence' },
  { name: 'label', align: 'left' as const, label: 'Операция', field: 'operationCode' },
  { name: 'amount', align: 'right' as const, label: 'Сумма', field: 'quantity' },
]

const pstColumns = [
  { name: 'date', align: 'left' as const, label: 'Дата', field: 'createdAt' },
  { name: 'posting', align: 'left' as const, label: '№ проводки', field: 'debitGlobalSequence' },
  { name: 'debit', align: 'center' as const, label: 'Дебет', field: 'debitAccountId' },
  { name: 'credit', align: 'center' as const, label: 'Кредит', field: 'creditAccountId' },
  { name: 'amount', align: 'right' as const, label: 'Сумма', field: 'quantity' },
]

// =====================================================================
// Документы процесса
// =====================================================================

function processDocs(hash: string): IProcessDocument[] {
  return processDetails.value.get(hash)?.documents ?? []
}

// document.hash — хеш ПОДПИСАННОГО документа (колонка hash в реестре), по нему
// открывается страница документа. rawDocument.hash = doc_hash — не подходит.
function docHash(d: IProcessDocument): string {
  const doc = d.document as any
  return doc?.hash || d.hash || ''
}

function toDocRow(d: IProcessDocument): DocumentRowDoc {
  const doc = d.document as any
  const raw = d.raw as any
  const signers: string[] = Array.isArray(doc?.signatures)
    ? doc.signatures
        .map((s: any) => getShortNameFromCertificate(s?.signer_certificate))
        .filter((x: string): x is string => !!x)
    : []
  return {
    type: 'pdf',
    title: doc?.meta?.title || raw?.full_title || 'Документ',
    date: doc?.meta?.created_at || undefined,
    author: signers.length ? signers.join(', ') : undefined,
  }
}

// Документ уже загружен целиком в getProcess (document + raw). Открываем его
// во всплывающем окне через BaseDocument — без догрузки и переадресации.
// IDocumentAggregate ждёт поле rawDocument, в процессном документе оно `raw`.
function openDoc(d: IProcessDocument) {
  const doc = d.document as any
  viewerDoc.value = { document: d.document, rawDocument: d.raw } as unknown as IDocumentAggregate
  viewerTitle.value = doc?.meta?.title || (d.raw as any)?.full_title || 'Документ'
  viewerOpen.value = true
}

// =====================================================================
// Операции / проводки процесса
// =====================================================================

function processOps(hash: string): ILedger2Operation[] {
  return procOpsMap.value.get(hash) ?? []
}
function processPostings(hash: string): ILedger2Posting[] {
  return procPostingsMap.value.get(hash) ?? []
}

function goToOperation(seq: string) {
  router.push({
    name: 'reports-operations',
    params: { coopname: info.coopname },
    query: { operation_id: seq },
  })
}
function goToPosting(id: string) {
  router.push({
    name: 'reports-postings',
    params: { coopname: info.coopname },
    query: { posting_id: id },
  })
}

// =====================================================================
// Фильтры
// =====================================================================

async function applyUsernameFilter() {
  const v = (usernameInput.value ?? '').trim()
  filters.username = v || null
  const q = { ...route.query }
  if (filters.username) q.username = filters.username
  else delete q.username
  await router.replace({ query: q })
  reload()
}

async function clearProcessTypeFilter() {
  filters.processType = null
  const q = { ...route.query }
  delete q.process_type
  await router.replace({ query: q })
  reload()
}

async function clearUsernameFilter() {
  filters.username = null
  usernameInput.value = ''
  const q = { ...route.query }
  delete q.username
  await router.replace({ query: q })
  reload()
}

async function clearProcessHashFilter() {
  filters.processHash = null
  const q = { ...route.query }
  delete q.process_hash
  await router.replace({ query: q })
  reload()
}

async function resetFilters() {
  filters.processType = null
  filters.username = null
  filters.processHash = null
  usernameInput.value = ''
  const q = { ...route.query }
  delete q.process_type
  delete q.username
  delete q.process_hash
  await router.replace({ query: q })
  reload()
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
    const resp = await processStore.loadProcesses({
      filter: {
        coopname: info.coopname,
        ...(filters.processType ? { processType: filters.processType } : {}),
        ...(filters.username ? { username: filters.username } : {}),
        ...(filters.processHash ? { processHash: filters.processHash } : {}),
      },
      pagination: {
        page: pagination.value.page,
        limit: pagination.value.rowsPerPage,
        sortOrder: 'DESC',
      },
    })
    if (myId !== lastRequestId) return
    if (resp) {
      items.value = resp.items ?? []
      pagination.value.rowsNumber = resp.totalCount ?? 0
      enrichFio(items.value.map((r) => r.username))
      // Deep-link по process_hash — единственный процесс на странице,
      // разворачиваем его автоматически (как реестр операций по operation_id).
      if (filters.processHash && items.value.length === 1) {
        const only = items.value[0]
        if (only && !expanded.value.get(only.processHash)) {
          toggleExpand(only.processHash)
        }
      }
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

async function toggleExpand(processHash: string) {
  const wasOpen = expanded.value.get(processHash)
  expanded.value.set(processHash, !wasOpen)
  if (!wasOpen && !detailLoaded.value.has(processHash)) {
    await loadProcessDetail(processHash)
  }
}

async function loadProcessDetail(processHash: string) {
  try {
    // Документы + операции + проводки одного процесса грузим параллельно.
    const [view, history, postings] = await Promise.all([
      processStore.loadProcess({ coopname: info.coopname, hash: processHash }),
      ledger2Store.loadHistory({
        coopname: info.coopname,
        processHash,
        actionNames: ['apply', 'walmove', 'revert'],
        limit: 100,
        sortOrder: 'ASC',
      }),
      ledger2Store.loadPostings({
        coopname: info.coopname,
        processHash,
        limit: 100,
        sortOrder: 'ASC',
      }),
    ])
    if (view) processDetails.value.set(processHash, view)
    procOpsMap.value.set(processHash, history?.items ?? [])
    procPostingsMap.value.set(processHash, postings?.items ?? [])
    enrichFio((history?.items ?? []).map((o) => o.username))
  } catch (e) {
    FailAlert(e)
  } finally {
    detailLoaded.value.add(processHash)
  }
}

async function enrichFio(rawUsernames: (string | null | undefined)[]) {
  const usernames = [
    ...new Set(rawUsernames.filter((u): u is string => !!u && !fioCache.value.has(u))),
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
    if (route.query.process_type) {
      filters.processType = String(route.query.process_type)
    }
    if (route.query.username) {
      filters.username = String(route.query.username)
      usernameInput.value = filters.username
    }
    if (route.query.process_hash) {
      filters.processHash = String(route.query.process_hash).toLowerCase()
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
.op-header {
  border-left: 4px solid #9e9e9e;
  padding: 4px 0 4px 12px;
}
</style>
