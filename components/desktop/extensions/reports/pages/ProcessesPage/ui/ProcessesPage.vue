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
          q-td
            span {{ subjectName(props.row.username) }}
            q-chip.q-ml-xs(
              v-if='isBranch(props.row.username)'
              dense
              square
              size='sm'
              color='orange-1'
              text-color='orange-9'
              label='КУ'
            )
              q-tooltip Кооперативный участок
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
              //- Детализация процесса (документы + операции + проводки) —
              //- общий виджет; № операции/проводки ведут в реестры бухгалтера.
              ProcessDetailCard(
                :coopname='info.coopname'
                :process-hash='props.row.processHash'
                :process-type='props.row.processType'
                operation-route-name='reports-operations'
                posting-route-name='reports-postings'
              )

      template(#item='props')
        .col-12
          q-card.q-pa-md.q-mb-sm
            .row.items-center.q-gutter-x-md
              .col
                .text-caption.text-grey-6 {{ formatDate(props.row.lastSeenAt) }}
                .text-body2.text-weight-medium {{ processTypeLabel(props.row.processType) }}
              .col-12.text-caption.text-grey-7
                | {{ isBranch(props.row.username) ? 'Участок' : 'Пайщик' }}: {{ subjectName(props.row.username) }}
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
import { useProcessStore, type IProcessSummary } from 'src/entities/Process'
import { useFioCache } from 'src/shared/lib/account/useFioCache'
import { ProcessDetailCard } from 'src/widgets/Process/ProcessDetailCard'
import {
  processChipBg,
  processChipText,
  processTypeLabel,
} from 'src/shared/lib/ledger2'
import { Ledger2 } from 'cooptypes'
import { Zeus } from '@coopenomics/sdk'

const { info } = useSystemStore()
const { isMobile } = useWindowSize()
const route = useRoute()
const router = useRouter()
const processStore = useProcessStore()
const { fioCache, kindCache, enrichFio } = useFioCache()

// Человекочитаемое имя субъекта процесса (пайщик/КУ/кооператив) — резолв с бэка.
function subjectName(username: string | null | undefined): string {
  const u = username ?? ''
  return fioCache.value.get(u) || u || '—'
}
// Субъект — кооперативный участок (показываем метку, чтобы не путать с пайщиком).
function isBranch(username: string | null | undefined): boolean {
  return kindCache.value.get(username ?? '') === Zeus.AccountKind.branch
}

const loading = ref(false)
const items = ref<IProcessSummary[]>([])
const expanded = ref(new Map<string, boolean>())

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

// Детализация процесса грузится внутри ProcessDetailCard при разворачивании
// строки (виджет монтируется по v-if) — странице достаточно переключить флаг.
function toggleExpand(processHash: string) {
  expanded.value.set(processHash, !expanded.value.get(processHash))
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
/* Реестр — обзорный список: гасим подсветку строки при наведении (canon-правило
   .q-table tbody tr:hover) и в основной таблице, и во вложенных таблицах
   детализации (операции/проводки) — мигание при наведении мешает. */
.page-shell :deep(.q-table tbody tr:hover) {
  background: transparent;
}
</style>
