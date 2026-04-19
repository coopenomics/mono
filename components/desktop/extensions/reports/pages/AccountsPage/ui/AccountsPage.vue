<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Счета
    .hero-subtitle План счетов кооператива с оборотами и сальдо

  q-card.q-mt-md(flat)
    q-table.full-height(
      flat
      :grid='isMobile'
      :rows='accounts'
      :columns='columns'
      row-key='id'
      :pagination='pagination'
      virtual-scroll
      :virtual-scroll-item-size='48'
      :loading='loading'
      :no-data-label='"План счетов не найден"'
    )
      template(#header='props')
        q-tr(:props='props')
          q-th(v-for='col in props.cols' :key='col.name' :props='props') {{ col.label }}

      template(#body='props')
        q-tr(:key='`acc_${props.row.id}`' :props='props')
          q-td(auto-width)
            ExpandToggleButton(
              :expanded='expanded.get(props.row.id)'
              @click='toggleExpand(props.row.id)'
            )
          q-td
            .text-weight-medium.font-monospace {{ props.row.displayId }}
          q-td {{ props.row.name }}
          q-td.text-right {{ formatAsset2Digits(props.row.available) }}
          q-td.text-right {{ formatAsset2Digits(props.row.blocked) }}
          q-td.text-right.text-weight-bold {{ formatAsset2Digits(props.row.available) }}
          q-td(auto-width)
            q-btn(
              flat
              dense
              size='sm'
              color='primary'
              icon='fa-solid fa-list-ul'
              :to='{ name: "reports-operations", query: { account_id: props.row.id } }'
            )
              q-tooltip Журнал проводок

        q-tr.q-virtual-scroll--with-prev(
          no-hover
          v-if='expanded.get(props.row.id)'
          :key='`exp_${props.row.id}`'
          :props='props'
        )
          q-td(colspan='100%')
            .q-pa-md
              LedgerHistoryTable(
                :filter='getAccountJournalFilter(props.row.id)'
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
                .text-h6.font-monospace {{ props.row.displayId }}
                .text-body2 {{ props.row.name }}
            .row.q-mt-sm
              .col-6
                .text-caption.text-grey-6 Дебет (доступно)
                .text-body2 {{ formatAsset2Digits(props.row.available) }}
              .col-6
                .text-caption.text-grey-6 Кредит (блок.)
                .text-body2 {{ formatAsset2Digits(props.row.blocked) }}
            .col-12(v-if='expanded.get(props.row.id)')
              q-separator.q-my-md
              LedgerHistoryTable(
                :filter='getAccountJournalFilter(props.row.id)'
                :hide-account-column='true'
                @error='handleError'
              )
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
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

const accounts = computed(() => ledgerStore.ledgerState?.chartOfAccounts || [])

const columns: any[] = [
  { name: 'expand', align: 'left', label: '', field: 'expand', sortable: false },
  { name: 'displayId', align: 'left', label: 'Счёт', field: 'displayId', sortable: true },
  { name: 'name', align: 'left', label: 'Наименование', field: 'name', sortable: true },
  { name: 'debit', align: 'right', label: 'Дебет (доступно)', field: 'available', sortable: true },
  { name: 'credit', align: 'right', label: 'Кредит (блок.)', field: 'blocked', sortable: true },
  {
    name: 'balance',
    align: 'right',
    label: 'Сальдо',
    // Сальдо = available − blocked (а не копия available): пайщик видел
    // две одинаковых цифры, принять решение о реальном остатке было нельзя.
    field: (row: { available: string | number; blocked: string | number }) => {
      const a = parseFloat(String(row.available ?? 0).split(' ')[0] || '0')
      const b = parseFloat(String(row.blocked ?? 0).split(' ')[0] || '0')
      return (a - b).toFixed(4)
    },
    sortable: true,
  },
  { name: 'actions', align: 'right', label: '', field: 'actions', sortable: false },
]

const toggleExpand = (id: number) => {
  expanded.value.set(id, !expanded.value.get(id))
}

const getAccountJournalFilter = (accountId: number): ILedgerHistoryFilter => ({
  coopname: info.coopname,
  account_id: accountId,
})

const handleError = (error: any) => FailAlert(error)

onMounted(async () => {
  try {
    loading.value = true
    if (!ledgerStore.ledgerState) {
      await ledgerStore.getLedgerState({ coopname: info.coopname })
    }
    await nextTick()
    if (route.query.account_id) {
      const id = Number(route.query.account_id)
      expanded.value.set(id, true)
    }
  } catch (e) {
    FailAlert(e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.font-monospace {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 0.03em;
}
</style>
