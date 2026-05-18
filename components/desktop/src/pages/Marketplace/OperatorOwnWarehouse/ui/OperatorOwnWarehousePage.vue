<template lang="pug">
q-page.mp-role-operator.q-pa-md
  .text-h5.q-mb-md Склад моего КУ

  q-card.mp-card.q-mb-md
    q-card-section.q-gutter-sm
      .row.q-col-gutter-sm.items-end
        q-input.col-12.col-sm-4(
          v-model='braname'
          label='Код кооперативного участка'
          dense
          outlined
          @keyup.enter='load'
        )
        q-select.col-12.col-sm-3(
          v-model='statusFilter'
          :options='statusOptions'
          label='Состояние'
          dense
          outlined
          multiple
          emit-value
          map-options
        )
        q-input.col-12.col-sm-3(
          v-model='ordererFilter'
          label='Заказчик'
          dense
          outlined
        )
        q-btn.col-12.col-sm-2(
          color='primary'
          label='Обновить'
          :loading='loading'
          @click='load'
        )

  .row.q-col-gutter-md.q-mb-md(v-if='items.length')
    q-card.mp-card.col-12.col-sm-3
      q-card-section
        .text-caption.text-grey-7 Активных наклеек
        .text-h6 {{ summary.totalActive }}
    q-card.mp-card.col-12.col-sm-3(
      v-for='(count, status) in summary.byStatus'
      :key='status'
    )
      q-card-section
        .text-caption.text-grey-7 {{ humanStatus(status) }}
        .text-h6 {{ count }}

  q-table.mp-card(
    :rows='filteredRows'
    :columns='columns'
    row-key='id'
    :loading='loading'
    :pagination='{ rowsPerPage: 25, sortBy: "labeled_at", descending: true }'
    :rows-per-page-options='[25, 50, 100, 0]'
    flat
    bordered
    binary-state-sort
  )
    template(#body-cell-status='props')
      q-td(:props='props')
        span.mp-status-chip(:class='statusChipClass(props.row.status)')
          | {{ humanStatus(props.row.status) }}

    template(#body-cell-age='props')
      q-td(:props='props') {{ formatAge(props.row.labeled_at) }}

    template(#body-cell-labeled_at='props')
      q-td(:props='props') {{ formatDateTime(props.row.labeled_at) }}

    template(#no-data)
      .full-width.text-center.q-pa-md.text-grey-7
        | {{ braname
        |   ? 'Наклеек по этому КУ нет — проверьте код или фильтры по состояниям.'
        |   : 'Введите код КУ и нажмите «Обновить».' }}
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import type { QTableProps } from 'quasar'
import { FailAlert } from 'src/shared/api'
import { Zeus } from '@coopenomics/sdk'
import { listInventory, type MarketplaceInventoryItemView } from '../api'

const braname = ref<string>('')
const statusFilter = ref<MarketplaceInventoryItemView['status'][]>([])
const ordererFilter = ref<string>('')
const items = ref<MarketplaceInventoryItemView[]>([])
const loading = ref(false)

type InventoryStatus = MarketplaceInventoryItemView['status']

const statusOptions: { label: string; value: InventoryStatus }[] = [
  { label: 'На складе', value: Zeus.MarketplaceInventoryStatus.LABELED },
  { label: 'Выдано пайщику', value: Zeus.MarketplaceInventoryStatus.ISSUED },
  { label: 'Возврат на склад', value: Zeus.MarketplaceInventoryStatus.RETURNED },
  { label: 'Списано', value: Zeus.MarketplaceInventoryStatus.WRITTEN_OFF },
]

const columns: QTableProps['columns'] = [
  { name: 'barcode_value', label: 'Штрих-код', field: 'barcode_value', align: 'left', sortable: true },
  { name: 'product', label: 'Товар', field: 'product_name_snapshot', align: 'left', sortable: true },
  { name: 'orderer', label: 'Заказчик', field: 'orderer_account_snapshot', align: 'left', sortable: true },
  { name: 'quantity', label: 'Ед.', field: 'quantity_per_label', align: 'right', sortable: true },
  { name: 'status', label: 'Состояние', field: 'status', align: 'left', sortable: true },
  { name: 'age', label: 'Возраст', field: 'labeled_at', align: 'right' },
  { name: 'labeled_at', label: 'Промаркировано', field: 'labeled_at', align: 'left', sortable: true },
]

const filteredRows = computed(() => {
  const orderer = ordererFilter.value.trim().toLowerCase()
  return items.value.filter((row) => {
    if (statusFilter.value.length && !statusFilter.value.includes(row.status)) return false
    if (orderer && !row.orderer_account_snapshot.toLowerCase().includes(orderer)) return false
    return true
  })
})

const summary = computed(() => {
  const byStatus: Record<string, number> = {}
  for (const row of items.value) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
  }
  return {
    byStatus,
    totalActive:
      (byStatus[Zeus.MarketplaceInventoryStatus.LABELED] ?? 0) +
      (byStatus[Zeus.MarketplaceInventoryStatus.ISSUED] ?? 0) +
      (byStatus[Zeus.MarketplaceInventoryStatus.RETURNED] ?? 0),
  }
})

async function load(): Promise<void> {
  if (!braname.value.trim()) {
    items.value = []
    return
  }
  loading.value = true
  try {
    items.value = await listInventory({ braname: braname.value.trim() })
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить склад КУ')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

function humanStatus(status: string): string {
  switch (status) {
    case Zeus.MarketplaceInventoryStatus.LABELED:
      return 'На складе'
    case Zeus.MarketplaceInventoryStatus.ISSUED:
      return 'Выдано пайщику'
    case Zeus.MarketplaceInventoryStatus.RETURNED:
      return 'Возврат на склад'
    case Zeus.MarketplaceInventoryStatus.WRITTEN_OFF:
      return 'Списано'
    default:
      return status
  }
}

function statusChipClass(status: string): string {
  switch (status) {
    case Zeus.MarketplaceInventoryStatus.LABELED:
      return 'mp-status-chip--info'
    case Zeus.MarketplaceInventoryStatus.ISSUED:
      return 'mp-status-chip--success'
    case Zeus.MarketplaceInventoryStatus.RETURNED:
      return 'mp-status-chip--warning'
    case Zeus.MarketplaceInventoryStatus.WRITTEN_OFF:
      return 'mp-status-chip--error'
    default:
      return 'mp-status-chip--neutral'
  }
}

function formatAge(value: unknown): string {
  if (value === null || value === undefined) return '—'
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return '—'
  const days = Math.floor((Date.now() - parsed.getTime()) / 86_400_000)
  if (days <= 0) return 'сегодня'
  if (days === 1) return '1 день'
  if (days < 5) return `${days} дня`
  return `${days} дней`
}

function formatDateTime(value: unknown): string {
  if (value === null || value === undefined) return '—'
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('ru-RU')
}
</script>
