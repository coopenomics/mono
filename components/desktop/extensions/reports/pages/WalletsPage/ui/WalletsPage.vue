<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Кошельки
    .hero-subtitle Список кошельков кооператива с историей операций

  q-card.q-mt-md(flat)
    q-table.full-height(
      flat
      :grid='isMobile'
      :rows='wallets'
      :columns='columns'
      row-key='id'
      :pagination='pagination'
      virtual-scroll
      :virtual-scroll-item-size='48'
      :loading='loading'
      :no-data-label='"Кошельки не найдены"'
    )
      template(#header='props')
        q-tr(:props='props')
          q-th(v-for='col in props.cols' :key='col.name' :props='props') {{ col.label }}

      template(#body='props')
        q-tr(:key='`wallet_${props.row.id}`' :props='props')
          q-td(auto-width)
            ExpandToggleButton(
              :expanded='expanded.get(props.row.id)'
              @click='toggleExpand(props.row.id)'
            )
          q-td {{ props.row.id }}
          q-td {{ props.row.name }}
          q-td.text-right {{ formatAsset2Digits(props.row.available) }}
          q-td.text-right {{ formatAsset2Digits(props.row.blocked) }}
          q-td(auto-width)
            q-btn(
              flat
              dense
              size='sm'
              color='primary'
              icon='fa-solid fa-list-ul'
              :to='{ name: "reports-operations", query: { wallet_id: props.row.id } }'
            )
              q-tooltip Смотреть операции

        q-tr.q-virtual-scroll--with-prev(
          no-hover
          v-if='expanded.get(props.row.id)'
          :key='`exp_${props.row.id}`'
          :props='props'
        )
          q-td(colspan='100%')
            .q-pa-md
              LedgerHistoryTable(
                :filter='getWalletHistoryFilter(props.row.id)'
                :hide-account-column='true'
                @error='handleError'
              )

      template(#item='props')
        .col-12
          q-card.q-pa-md.q-mb-sm
            .row.items-center.q-gutter-x-md
              .col-auto
                ExpandToggleButton(
                  :expanded='expanded.get(props.row.id)'
                  @click='toggleExpand(props.row.id)'
                )
              .col
                .text-body1 {{ props.row.name }}
                .text-caption.text-grey-6 ID: {{ props.row.id }}
            .row.q-mt-sm
              .col-6
                .text-caption.text-grey-6 Доступно
                .text-body2.text-weight-medium {{ formatAsset2Digits(props.row.available) }}
              .col-6
                .text-caption.text-grey-6 Заблокировано
                .text-body2.text-weight-medium {{ formatAsset2Digits(props.row.blocked) }}
            .col-12(v-if='expanded.get(props.row.id)')
              q-separator.q-my-md
              LedgerHistoryTable(
                :filter='getWalletHistoryFilter(props.row.id)'
                :hide-account-column='true'
                @error='handleError'
              )
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useWindowSize } from 'src/shared/hooks'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { useSystemStore } from 'src/entities/System/model'
import { useLedgerAccountStore } from 'src/entities/LedgerAccount/model'
import { LedgerHistoryTable } from 'src/widgets/LedgerAccounts'
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton'
import { FailAlert } from 'src/shared/api'
import type { ILedgerHistoryFilter } from 'src/entities/LedgerAccount/types'

const { info } = useSystemStore()
const ledgerStore = useLedgerAccountStore()
const { isMobile } = useWindowSize()
const route = useRoute()

const loading = ref(false)
const pagination = ref({ rowsPerPage: 0 })
const expanded = ref(new Map<number, boolean>())

const wallets = computed(() => ledgerStore.ledgerState?.chartOfAccounts || [])

const columns: any[] = [
  { name: 'expand', align: 'left', label: '', field: 'expand', sortable: false },
  { name: 'id', align: 'left', label: 'ID', field: 'id', sortable: true },
  { name: 'name', align: 'left', label: 'Наименование', field: 'name', sortable: true },
  { name: 'available', align: 'right', label: 'Доступно', field: 'available', sortable: true },
  { name: 'blocked', align: 'right', label: 'Заблокировано', field: 'blocked', sortable: true },
  { name: 'actions', align: 'right', label: '', field: 'actions', sortable: false },
]

const toggleExpand = (id: number) => {
  expanded.value.set(id, !expanded.value.get(id))
}

const getWalletHistoryFilter = (walletId: number): ILedgerHistoryFilter => ({
  coopname: info.coopname,
  account_id: walletId,
})

const handleError = (error: any) => FailAlert(error)

onMounted(async () => {
  try {
    loading.value = true
    if (!ledgerStore.ledgerState) {
      await ledgerStore.getLedgerState({ coopname: info.coopname })
    }
    if (route.query.wallet_id) {
      const id = Number(route.query.wallet_id)
      expanded.value.set(id, true)
    }
  } catch (e) {
    FailAlert(e)
  } finally {
    loading.value = false
  }
})
</script>
