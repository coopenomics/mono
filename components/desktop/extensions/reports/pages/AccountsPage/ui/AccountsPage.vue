<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Счета
    .hero-subtitle План счетов кооператива (ledger2) с оборотами и сальдо

  q-card.q-mt-md(flat)
    q-table.full-height(
      flat
      :grid='isMobile'
      :rows='accounts'
      :columns='columns'
      row-key='id'
      :pagination='pagination'
      :loading='loading'
      :no-data-label='"План счетов не найден"'
    )
      template(#header='props')
        q-tr(:props='props')
          q-th(v-for='col in props.cols' :key='col.name' :props='props') {{ col.label }}

      template(#body='props')
        q-tr(:key='`acc_${props.row.id}`' :props='props')
          q-td.font-monospace {{ props.row.id }}
          q-td {{ props.row.name }}
          q-td.text-right {{ formatAsset2Digits(props.row.debitBalance) }}
          q-td.text-right {{ formatAsset2Digits(props.row.creditBalance) }}
          q-td.text-right.text-weight-bold {{ formatAsset2Digits(props.row.balance) }}
          q-td
            q-badge(
              outline
              :color='props.row.accountType === 0 ? "blue" : "deep-purple"'
              size='sm'
            ) {{ props.row.accountType === 0 ? 'Активный' : 'Пассивный' }}
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

      template(#item='props')
        .col-12
          q-card.q-pa-md.q-mb-sm
            .row.items-center.q-gutter-x-md
              .col
                .text-h6.font-monospace {{ props.row.id }}
                .text-body2 {{ props.row.name }}
                q-badge.q-mt-xs(
                  outline
                  :color='props.row.accountType === 0 ? "blue" : "deep-purple"'
                  size='sm'
                ) {{ props.row.accountType === 0 ? 'Активный' : 'Пассивный' }}
              .col-auto
                q-btn(
                  flat
                  dense
                  size='sm'
                  color='primary'
                  icon='fa-solid fa-list-ul'
                  :to='{ name: "reports-operations", query: { account_id: props.row.id } }'
                )
                  q-tooltip Журнал проводок
            .row.q-mt-sm
              .col-4
                .text-caption.text-grey-6 Дебет
                .text-body2 {{ formatAsset2Digits(props.row.debitBalance) }}
              .col-4
                .text-caption.text-grey-6 Кредит
                .text-body2 {{ formatAsset2Digits(props.row.creditBalance) }}
              .col-4
                .text-caption.text-grey-6 Сальдо
                .text-body2.text-weight-bold {{ formatAsset2Digits(props.row.balance) }}
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWindowSize } from 'src/shared/hooks'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { useSystemStore } from 'src/entities/System/model'
import { ledger2Api, type ILedger2Account } from 'src/entities/Ledger2'
import { FailAlert } from 'src/shared/api'

const { info } = useSystemStore()
const { isMobile } = useWindowSize()

const loading = ref(false)
const pagination = ref({ rowsPerPage: 0 })
const accounts = ref<ILedger2Account[]>([])

const columns: any[] = [
  { name: 'id', align: 'left', label: 'Счёт', field: 'id', sortable: true },
  { name: 'name', align: 'left', label: 'Наименование', field: 'name', sortable: true },
  { name: 'debit', align: 'right', label: 'Дебет', field: 'debitBalance', sortable: true },
  { name: 'credit', align: 'right', label: 'Кредит', field: 'creditBalance', sortable: true },
  { name: 'balance', align: 'right', label: 'Сальдо', field: 'balance', sortable: true },
  { name: 'accountType', align: 'left', label: 'Тип', field: 'accountType', sortable: true },
  { name: 'actions', align: 'right', label: '', field: 'actions', sortable: false },
]

onMounted(async () => {
  try {
    loading.value = true
    accounts.value = await ledger2Api.getAccounts(info.coopname)
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
