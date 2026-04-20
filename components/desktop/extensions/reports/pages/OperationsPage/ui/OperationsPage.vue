<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Операции
    .hero-subtitle Журнал операций ledger2 — apply / walletop / debit / credit

  //- Панель фильтров (всё на сервер — клиентская фильтрация некорректна
  //- при пагинации: выбирали бы только из догруженных страниц)
  q-card.q-mt-md(flat)
    q-card-section
      .row.q-gutter-sm.items-end
        q-input.col-md-2.col-12(
          v-model='filters.dateFrom'
          type='date'
          label='С даты'
          dense
          outlined
          clearable
          @update:model-value='reload'
        )
        q-input.col-md-2.col-12(
          v-model='filters.dateTo'
          type='date'
          label='По дату'
          dense
          outlined
          clearable
          @update:model-value='reload'
        )
        q-select.col-md-3.col-12(
          v-model='filters.actionNames'
          :options='actionNameOptions'
          label='Действия ledger2'
          multiple
          dense
          outlined
          use-chips
          emit-value
          map-options
          clearable
          @update:model-value='reload'
        )
        q-input.col-md-2.col-12(
          v-model='filters.username'
          label='Пользователь'
          dense
          outlined
          clearable
          debounce='400'
          @update:model-value='reload'
        )
        q-btn.col-md-auto(
          v-if='hasAnyFilter'
          flat
          icon='fa-solid fa-rotate'
          label='Сбросить'
          @click='resetFilters'
        )

  //- Таблица операций — server-side пагинация
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
              @click='toggleExpand(props.row.globalSequence)'
            )
          q-td {{ formatDate(props.row.createdAt) }}
          q-td
            q-badge(
              outline
              :color='getActionColor(props.row.action)'
              size='sm'
            ) {{ props.row.action }}
          q-td {{ props.row.actionCode || '-' }}
          q-td {{ props.row.username || '-' }}
          q-td(style='max-width: 150px; word-wrap: break-word') {{ props.row.accountId ?? '-' }}
          q-td.text-left {{ props.row.quantity || '-' }}

        q-tr.q-virtual-scroll--with-prev(
          no-hover
          v-if='expanded.get(props.row.globalSequence)'
          :key='`exp_${props.row.globalSequence}`'
          :props='props'
        )
          q-td(colspan='100%')
            .q-pa-md.row.q-gutter-md
              .col-md-4.col-12
                .text-subtitle2.q-mb-xs Проводка
                .text-body2 Счёт/кошелёк: {{ props.row.accountId ?? '-' }}
                .text-body2 Действие: {{ props.row.action }}
                .text-body2 Сумма: {{ props.row.quantity || '-' }}
              .col-md-4.col-12
                .text-subtitle2.q-mb-xs Процесс
                .text-body2 Действие (ACTION_REGISTRY): {{ props.row.actionCode || '-' }}
                .text-body2 Process hash: {{ props.row.processHash || '-' }}
                .text-body2 Заметка: {{ props.row.memo || '-' }}
              .col-md-4.col-12
                .text-subtitle2.q-mb-xs Переходы
                q-btn.q-mr-sm(
                  v-if='props.row.accountId'
                  flat
                  dense
                  size='sm'
                  color='primary'
                  icon='fa-solid fa-sitemap'
                  label='К счёту'
                  :to='{ name: "reports-accounts", query: { account_id: props.row.accountId } }'
                )
                q-btn(
                  v-if='props.row.accountId'
                  flat
                  dense
                  size='sm'
                  color='primary'
                  icon='fa-solid fa-wallet'
                  label='К кошельку'
                  :to='{ name: "reports-wallets", query: { wallet_id: props.row.accountId } }'
                )

      template(#item='props')
        .col-12
          q-card.q-pa-md.q-mb-sm
            .row.items-center.q-gutter-x-md
              .col-auto
                q-badge(
                  outline
                  :color='getActionColor(props.row.action)'
                  size='sm'
                ) {{ props.row.action }}
              .col
                .text-caption.text-grey-6 {{ formatDate(props.row.createdAt) }}
                .text-body2.text-weight-medium {{ props.row.actionCode || '-' }}
              .col-12(v-if='props.row.quantity')
                .text-body1.text-weight-bold.text-primary {{ props.row.quantity }}
              .col-12.text-caption.text-grey-7
                | Счёт/кошелёк: {{ props.row.accountId ?? '-' }} · Пользователь: {{ props.row.username || '-' }}
</template>

<script setup lang="ts">
import { computed, onMounted, nextTick, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useWindowSize } from 'src/shared/hooks'
import { useSystemStore } from 'src/entities/System/model'
import { FailAlert } from 'src/shared/api'
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton'
import {
  ledger2Api,
  type ILedger2Operation,
  type ILedger2HistoryFilterInput,
} from 'src/entities/Ledger2'

const { info } = useSystemStore()
const { isMobile } = useWindowSize()
const route = useRoute()

const loading = ref(false)
const items = ref<ILedger2Operation[]>([])
const expanded = ref(new Map<string, boolean>())
const rowRefs = new Map<string, HTMLElement | null>()

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
  actionNames: string[]
  username: string
  accountId: number | null
}>({
  dateFrom: '',
  dateTo: '',
  actionNames: [],
  username: '',
  accountId: null,
})

const actionNameOptions = [
  { label: 'apply — мета процесса', value: 'apply' },
  { label: 'walletop — движение кошелька', value: 'walletop' },
  { label: 'debit — дебет', value: 'debit' },
  { label: 'credit — кредит', value: 'credit' },
]

const columns = [
  { name: 'expand', align: 'left' as const, label: '', field: 'expand', sortable: false },
  { name: 'createdAt', align: 'left' as const, label: 'Дата', field: 'createdAt' },
  { name: 'action', align: 'left' as const, label: 'Действие', field: 'action' },
  { name: 'actionCode', align: 'left' as const, label: 'ACTION_REGISTRY', field: 'actionCode' },
  { name: 'username', align: 'left' as const, label: 'Пользователь', field: 'username' },
  { name: 'accountId', align: 'left' as const, label: 'ID', field: 'accountId' },
  { name: 'quantity', align: 'left' as const, label: 'Сумма', field: 'quantity' },
]

const hasAnyFilter = computed(() => (
  !!filters.dateFrom
  || !!filters.dateTo
  || filters.actionNames.length > 0
  || !!filters.username
  || filters.accountId !== null
))

function resetFilters() {
  filters.dateFrom = ''
  filters.dateTo = ''
  filters.actionNames = []
  filters.username = ''
  filters.accountId = null
  reload()
}

function toggleExpand(seq: string) {
  expanded.value.set(seq, !expanded.value.get(seq))
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function getActionColor(a: string): string {
  return ({ apply: 'deep-purple', walletop: 'teal', debit: 'green', credit: 'red' }[a] || 'grey')
}

// Seq-guard против race'а при быстрых кликах по пагинации.
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
      page: pagination.value.page,
      limit: pagination.value.rowsPerPage,
      sortOrder: 'DESC',
    }
    if (filters.accountId !== null) input.accountId = filters.accountId
    if (filters.actionNames.length > 0) input.actionNames = filters.actionNames
    if (filters.username) input.username = filters.username
    if (filters.dateFrom) input.dateFrom = new Date(filters.dateFrom)
    if (filters.dateTo) {
      const to = new Date(filters.dateTo)
      to.setHours(23, 59, 59, 999)
      input.dateTo = to
    }

    const resp = await ledger2Api.getHistory(input)
    if (myId !== lastRequestId) return
    if (resp) {
      items.value = resp.items
      pagination.value.rowsNumber = resp.totalCount
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

onMounted(async () => {
  try {
    // account_id и wallet_id взаимоисключающие — берём что пришло первым.
    if (route.query.account_id) {
      filters.accountId = Number(route.query.account_id)
    } else if (route.query.wallet_id) {
      filters.accountId = Number(route.query.wallet_id)
    }
    await load()

    if (route.query.operation_id) {
      const seq = String(route.query.operation_id)
      expanded.value.set(seq, true)
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
.font-monospace {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 0.03em;
}
</style>
