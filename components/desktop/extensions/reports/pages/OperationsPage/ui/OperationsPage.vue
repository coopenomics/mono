<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Операции
    .hero-subtitle Журнал именованных операций с перекрёстными ссылками на счета и кошельки

  //- Панель фильтров
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
        )
        q-input.col-md-2.col-12(
          v-model='filters.dateTo'
          type='date'
          label='По дату'
          dense
          outlined
          clearable
        )
        q-select.col-md-3.col-12(
          v-model='filters.actions'
          :options='actionOptions'
          label='Операция'
          multiple
          dense
          outlined
          use-chips
          emit-value
          map-options
          clearable
        )
        q-input.col-md-2.col-12(
          v-model='filters.username'
          label='Пользователь'
          dense
          outlined
          clearable
        )
        q-input.col-md-2.col-12(
          v-model='filters.memo'
          label='Поиск по memo'
          dense
          outlined
          clearable
        )
        q-btn.col-md-auto(
          flat
          icon='fa-solid fa-rotate'
          label='Сбросить'
          @click='resetFilters'
          v-if='hasAnyFilter'
        )

  //- Таблица операций
  q-card.q-mt-md(flat)
    q-table.full-height(
      flat
      :grid='isMobile'
      :rows='filteredOperations'
      :columns='columns'
      row-key='global_sequence'
      :pagination='pagination'
      virtual-scroll
      :virtual-scroll-item-size='48'
      :loading='loading'
      :no-data-label='"Операции не найдены"'
      @virtual-scroll='onVirtualScroll'
    )
      template(#body='props')
        q-tr(
          :key='`op_${props.row.global_sequence}`'
          :data-seq='props.row.global_sequence'
          :props='props'
        )
          q-td(auto-width)
            ExpandToggleButton(
              :expanded='expanded.get(props.row.global_sequence)'
              @click='toggleExpand(props.row.global_sequence)'
            )
          q-td {{ formatDate(props.row.created_at) }}
          q-td
            q-badge(
              outline
              :color='getActionColor(props.row.action)'
              size='sm'
            ) {{ getActionLabel(props.row.action) }}
          q-td {{ props.row.username || '-' }}
          q-td.text-left {{ props.row.quantity || '-' }}
          q-td(style='max-width: 200px; word-wrap: break-word; white-space: normal') {{ props.row.comment || '-' }}

        q-tr.q-virtual-scroll--with-prev(
          no-hover
          v-if='expanded.get(props.row.global_sequence)'
          :key='`exp_${props.row.global_sequence}`'
          :props='props'
        )
          q-td(colspan='100%')
            .q-pa-md.bg-grey-2.rounded-borders
              .row.q-col-gutter-md
                //- Блок 1: проводка Dr/Cr
                .col-md-4.col-12
                  .text-subtitle2.q-mb-xs Проводка
                  .text-body2 Счёт: {{ getAccountInfo(props.row.account_id) }}
                  .text-body2 Действие: {{ getActionLabel(props.row.action) }}
                  .text-body2 Сумма: {{ props.row.quantity || '-' }}
                //- Блок 2: движение
                .col-md-4.col-12
                  .text-subtitle2.q-mb-xs Движение
                  .text-body2 Дата: {{ formatDate(props.row.created_at) }}
                  .text-body2 Пользователь: {{ props.row.username || '-' }}
                  .text-body2 Hash: {{ props.row.hash || '-' }}
                //- Блок 3: ссылки перехода
                .col-md-4.col-12
                  .text-subtitle2.q-mb-xs Переходы
                  q-btn.q-mr-sm(
                    v-if='props.row.account_id'
                    flat
                    dense
                    size='sm'
                    color='primary'
                    icon='fa-solid fa-sitemap'
                    label='К счёту'
                    :to='{ name: "reports-accounts", query: { account_id: props.row.account_id, operation_id: props.row.global_sequence } }'
                  )
                  q-btn(
                    v-if='props.row.account_id'
                    flat
                    dense
                    size='sm'
                    color='primary'
                    icon='fa-solid fa-wallet'
                    label='К кошельку'
                    :to='{ name: "reports-wallets", query: { wallet_id: props.row.account_id, operation_id: props.row.global_sequence } }'
                  )

      template(#item='props')
        .col-12
          q-card.q-pa-md.q-mb-sm
            .row.items-center.q-gutter-x-md
              .col-auto
                q-chip(
                  :color='getActionColor(props.row.action)'
                  text-color='white'
                  size='sm'
                ) {{ getActionLabel(props.row.action) }}
              .col
                .text-caption.text-grey-6 {{ formatDate(props.row.created_at) }}
                .text-body2.text-weight-medium {{ getAccountInfo(props.row.account_id) }}
              .col-12(v-if='props.row.quantity')
                .text-body1.text-weight-bold.text-primary {{ props.row.quantity }}
              .col-12(v-if='props.row.comment')
                .text-caption.text-grey-7 {{ props.row.comment }}

    .row.justify-center.q-pa-md(v-if='loading && operations.length > 0')
      q-spinner(color='primary' size='2em')
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useWindowSize } from 'src/shared/hooks'
import {
  useLocalLedgerHistory,
  useLedgerAccountStore,
} from 'src/entities/LedgerAccount/model'
import { useSystemStore } from 'src/entities/System/model'
import { FailAlert } from 'src/shared/api'
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton'
import type { ILedgerOperation } from 'src/entities/LedgerAccount/types'

const { info } = useSystemStore()
const ledgerStore = useLedgerAccountStore()
const { operations, loading, hasMore, loadHistory, loadMoreHistory } = useLocalLedgerHistory()
const { isMobile } = useWindowSize()
const route = useRoute()

const pagination = ref({ rowsPerPage: 0 })
const expanded = ref(new Map<number, boolean>())

const filters = ref({
  dateFrom: '',
  dateTo: '',
  actions: [] as string[],
  username: '',
  memo: '',
})

const actionOptions = [
  { label: 'Дебет', value: 'debet' },
  { label: 'Кредит', value: 'credit' },
  { label: 'Блокировка', value: 'block' },
  { label: 'Разблокировка', value: 'unblock' },
  { label: 'Увеличение', value: 'add' },
  { label: 'Уменьшение', value: 'sub' },
]

const columns = [
  { name: 'expand', align: 'left' as const, label: '', field: 'expand', sortable: false },
  { name: 'created_at', align: 'left' as const, label: 'Дата', field: 'created_at' },
  { name: 'action', align: 'left' as const, label: 'Операция', field: 'action' },
  { name: 'username', align: 'left' as const, label: 'Пользователь', field: 'username' },
  { name: 'quantity', align: 'left' as const, label: 'Сумма', field: 'quantity' },
  { name: 'comment', align: 'left' as const, label: 'Комментарий', field: 'comment' },
]

const hasAnyFilter = computed(() => (
  !!filters.value.dateFrom
  || !!filters.value.dateTo
  || (filters.value.actions && filters.value.actions.length > 0)
  || !!filters.value.username
  || !!filters.value.memo
))

const filteredOperations = computed(() => {
  let list = operations.value || []

  if (filters.value.dateFrom) {
    const from = new Date(filters.value.dateFrom).getTime()
    list = list.filter(op => new Date(op.created_at).getTime() >= from)
  }
  if (filters.value.dateTo) {
    const to = new Date(filters.value.dateTo).getTime() + 86400000
    list = list.filter(op => new Date(op.created_at).getTime() <= to)
  }
  if (filters.value.actions && filters.value.actions.length > 0) {
    list = list.filter(op => filters.value.actions.includes(op.action))
  }
  if (filters.value.username) {
    const u = filters.value.username.toLowerCase()
    list = list.filter(op => (op.username || '').toLowerCase().includes(u))
  }
  if (filters.value.memo) {
    const m = filters.value.memo.toLowerCase()
    list = list.filter(op => (op.comment || '').toLowerCase().includes(m))
  }
  return list
})

const resetFilters = () => {
  filters.value = { dateFrom: '', dateTo: '', actions: [], username: '', memo: '' }
}

const toggleExpand = (seq: number) => {
  expanded.value.set(seq, !expanded.value.get(seq))
}

const formatDate = (d: string): string => new Date(d).toLocaleString('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

const getActionColor = (a: string): string => ({
  debet: 'green', credit: 'red', block: 'orange', unblock: 'teal',
  writeoff: 'deep-orange', writeoffcnsl: 'purple', add: 'green', sub: 'red',
}[a] || 'grey')

const getActionLabel = (a: string): string => ({
  debet: 'Дебет', credit: 'Кредит', block: 'Блокировка', unblock: 'Разблокировка',
  writeoff: 'Списание', writeoffcnsl: 'Отмена списания', add: 'Увеличение', sub: 'Уменьшение',
}[a] || a)

const getAccountInfo = (accountId?: number): string => {
  if (!accountId) return '-'
  const accounts = ledgerStore.ledgerState?.chartOfAccounts || []
  const acc = accounts.find(a => a.id === accountId)
  return acc ? `${acc.displayId}. ${acc.name}` : `Счёт ${accountId}`
}

const onVirtualScroll = async (details: { to: number }) => {
  if (
    details.to === operations.value.length - 1
    && hasMore.value
    && !loading.value
  ) {
    try {
      await loadMoreHistory()
    } catch (e) {
      FailAlert(e)
    }
  }
}

onMounted(async () => {
  try {
    if (!ledgerStore.ledgerState) {
      await ledgerStore.getLedgerState({ coopname: info.coopname })
    }

    const historyFilter: any = { coopname: info.coopname }
    // account_id и wallet_id взаимоисключающие — берём что пришло первым,
    // не позволяем wallet_id затереть уже выставленный account_id.
    if (route.query.account_id) {
      historyFilter.account_id = Number(route.query.account_id)
    } else if (route.query.wallet_id) {
      historyFilter.account_id = Number(route.query.wallet_id)
    }
    await loadHistory(historyFilter)

    if (route.query.operation_id) {
      const seq = Number(route.query.operation_id)
      expanded.value.set(seq, true)
      nextTick(() => {
        // Vue-атрибут :key не рендерится в DOM — используем data-seq.
        const el = document.querySelector(`[data-seq="${seq}"]`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  } catch (e) {
    FailAlert(e)
  }
})

</script>
