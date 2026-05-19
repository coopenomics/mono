<template lang="pug">
div.page-shell
  q-card.q-mt-md(flat)
    q-card-section
      .row.q-gutter-sm.items-center.q-mb-sm(v-if='filters.processType || filters.username')
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
              @click='toggleExpand(props.row.processHash, props.row.processType)'
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
          q-td(auto-width)
            q-btn(
              flat
              dense
              icon='fa-solid fa-list-ul'
              :to='operationsRoute(props.row.processHash)'
            )
              q-tooltip Открыть в реестре операций

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
                  .text-caption.text-grey-7 Тип процесса:
                  EntityIdBadge(:rawId='props.row.processType' copy-on-click)
                .row.items-center.q-gutter-sm.q-mb-xs
                  .text-caption.text-grey-7 ID процесса:
                  EntityIdBadge(:rawId='props.row.processHash' copy-on-click)

              template(v-if='!detailLoaded.has(props.row.processHash)')
                q-spinner(size='sm')
              template(v-else)
                .row.q-col-gutter-md
                  .col-12.col-md-6
                    q-card(flat bordered)
                      q-card-section.q-pb-none
                        .text-subtitle2 События процесса
                      q-card-section.q-pt-sm
                        .text-body2(v-if='!processDetails.get(props.row.processHash)?.actions?.length') Нет событий
                        q-list(v-else dense)
                          q-item(
                            v-for='a in processDetails.get(props.row.processHash)!.actions'
                            :key='a.global_sequence'
                          )
                            q-item-section
                              q-item-label.font-monospace {{ a.account }}::{{ a.name }}
                              q-item-label(caption) {{ formatDate(a.created_at) }} · seq {{ a.global_sequence }}
                  .col-12.col-md-6
                    q-card(flat bordered)
                      q-card-section.q-pb-none
                        .text-subtitle2 Документы
                      q-card-section.q-pt-sm
                        .text-body2(v-if='!processDetails.get(props.row.processHash)?.documents?.length') Документы не приложены
                        q-list(v-else dense)
                          q-item(
                            v-for='d in processDetails.get(props.row.processHash)!.documents'
                            :key='d.registry_id + "-" + d.document_hash'
                          )
                            q-item-section
                              q-item-label registry_id {{ d.registry_id }}
                              q-item-label(caption).font-monospace {{ d.document_hash }}

              .q-mt-md(v-if='hasProcessInfo(props.row.processType)')
                q-card(flat bordered)
                  q-card-section.q-pb-none
                    .text-subtitle2 Содержание процесса
                  q-card-section.q-pt-sm
                    component(
                      :is='processInfoComponent(props.row.processType)'
                      :process-hash='props.row.processHash'
                      :process-type='props.row.processType'
                      :coopname='info.coopname'
                    )

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
} from 'src/entities/Process'
import { useAccountStore } from 'src/entities/Account'
import { Ledger2 } from 'cooptypes'
import { processInfoFactory } from 'src/shared/lib/process-info-factory'

const { info } = useSystemStore()
const { isMobile } = useWindowSize()
const route = useRoute()
const router = useRouter()
const processStore = useProcessStore()
const accountStore = useAccountStore()

const loading = ref(false)
const items = ref<IProcessSummary[]>([])
const expanded = ref(new Map<string, boolean>())
const fioCache = ref(new Map<string, string>())
const detailLoaded = ref(new Set<string>())
const processDetails = ref(new Map<string, IProcessView>())

const pagination = ref({ page: 1, rowsPerPage: 50, rowsNumber: 0 })

const filters = reactive<{
  processType: string | null
  username: string | null
}>({
  processType: null,
  username: null,
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

function hasProcessInfo(type: string | null | undefined): boolean {
  return !!type && processInfoFactory.hasHandler(type)
}
function processInfoComponent(type: string | null | undefined) {
  return type ? processInfoFactory.getInfoComponent(type) : undefined
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

const hasAnyFilter = computed(() => !!filters.processType || !!filters.username)

const columns = [
  { name: 'expand', align: 'left' as const, label: '', field: 'expand', sortable: false },
  { name: 'processType', align: 'left' as const, label: 'Тип процесса', field: 'processType' },
  { name: 'processHash', align: 'left' as const, label: 'ID процесса', field: 'processHash' },
  { name: 'username', align: 'left' as const, label: 'Пайщик', field: 'username' },
  { name: 'firstSeenAt', align: 'left' as const, label: 'Создан', field: 'firstSeenAt' },
  { name: 'lastSeenAt', align: 'left' as const, label: 'Последнее событие', field: 'lastSeenAt' },
  { name: 'actions', align: 'right' as const, label: '', field: 'actions', sortable: false },
]

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

async function resetFilters() {
  filters.processType = null
  filters.username = null
  usernameInput.value = ''
  const q = { ...route.query }
  delete q.process_type
  delete q.username
  await router.replace({ query: q })
  reload()
}

function operationsRoute(processHash: string) {
  return {
    name: 'reports-operations',
    params: { coopname: info.coopname },
    query: { process_hash: processHash },
  }
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
      },
      pagination: {
        page: pagination.value.page,
        limit: pagination.value.rowsPerPage,
      },
    })
    if (myId !== lastRequestId) return
    if (resp) {
      items.value = resp.items ?? []
      pagination.value.rowsNumber = resp.totalCount ?? 0
      enrichFio(items.value)
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

async function toggleExpand(processHash: string, processType: string) {
  const wasOpen = expanded.value.get(processHash)
  expanded.value.set(processHash, !wasOpen)
  if (!wasOpen && !detailLoaded.value.has(processHash)) {
    try {
      const view = await processStore.loadProcess({
        coopname: info.coopname,
        hash: processHash,
      })
      if (view) processDetails.value.set(processHash, view)
    } catch (e) {
      FailAlert(e)
    } finally {
      detailLoaded.value.add(processHash)
    }
  }
}

async function enrichFio(rows: IProcessSummary[]) {
  const usernames = [
    ...new Set(rows.map((r) => r.username).filter((u): u is string => !!u && !fioCache.value.has(u))),
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
        // молча
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
