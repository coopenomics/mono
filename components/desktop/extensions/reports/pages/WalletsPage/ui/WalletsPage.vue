<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Кошельки

  q-card.q-mt-md(flat)
    q-table.full-height(
      flat
      :grid='isMobile'
      :rows='wallets'
      :columns='columns'
      row-key='id'
      :pagination='pagination'
      :loading='loading'
      :no-data-label='"Кошельки не найдены"'
    )
      template(#header='props')
        q-tr(:props='props')
          q-th(v-for='col in props.cols' :key='col.name' :props='props') {{ col.label }}

      template(#body='props')
        q-tr(:key='`wallet_${props.row.id}`' :props='props')
          q-td.font-monospace {{ props.row.id }}
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

      template(#item='props')
        .col-12
          q-card.q-pa-md.q-mb-sm
            .row.items-center.q-gutter-x-md
              .col
                .text-body1 {{ props.row.name }}
                .text-caption.text-grey-6.font-monospace ID: {{ props.row.id }}
              .col-auto
                q-btn(
                  flat
                  dense
                  size='sm'
                  color='primary'
                  icon='fa-solid fa-list-ul'
                  :to='{ name: "reports-operations", query: { wallet_id: props.row.id } }'
                )
                  q-tooltip Смотреть операции
            .row.q-mt-sm
              .col-6
                .text-caption.text-grey-6 Доступно
                .text-body2.text-weight-medium {{ formatAsset2Digits(props.row.available) }}
              .col-6
                .text-caption.text-grey-6 Заблокировано
                .text-body2.text-weight-medium {{ formatAsset2Digits(props.row.blocked) }}
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWindowSize } from 'src/shared/hooks'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { useSystemStore } from 'src/entities/System/model'
import { ledger2Api, type ILedger2Wallet } from 'src/entities/Ledger2'
import { FailAlert } from 'src/shared/api'

const { info } = useSystemStore()
const { isMobile } = useWindowSize()

const loading = ref(false)
const pagination = ref({ rowsPerPage: 0 })
const wallets = ref<ILedger2Wallet[]>([])

const columns: any[] = [
  { name: 'id', align: 'left', label: 'ID', field: 'id', sortable: true },
  { name: 'name', align: 'left', label: 'Наименование', field: 'name', sortable: true },
  { name: 'available', align: 'right', label: 'Доступно', field: 'available', sortable: true },
  { name: 'blocked', align: 'right', label: 'Заблокировано', field: 'blocked', sortable: true },
  { name: 'actions', align: 'right', label: '', field: 'actions', sortable: false },
]

onMounted(async () => {
  try {
    loading.value = true
    wallets.value = await ledger2Api.getWallets(info.coopname)
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
