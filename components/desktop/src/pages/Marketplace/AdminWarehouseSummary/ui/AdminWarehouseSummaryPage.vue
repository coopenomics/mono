<template lang="pug">
q-page.mp-role-admin.q-pa-md
  .row.items-center.q-mb-md
    .text-h5.col Сводный склад кооператива
    q-btn(
      flat
      no-caps
      color='primary'
      icon='refresh'
      label='Обновить'
      :loading='loading'
      @click='load'
    )

  q-tabs.text-grey-7(
    v-model='tab'
    dense
    align='left'
    active-color='primary'
    indicator-color='primary'
    narrow-indicator
  )
    q-tab(name='warehouse' label='Сводный склад')
    q-tab(name='flow' label='Поток заказов и поставок')

  q-separator

  q-tab-panels(v-model='tab' animated keep-alive)
    q-tab-panel.q-px-none(name='warehouse')
      .row.q-col-gutter-md.q-mb-md
        q-card.mp-card.col-12.col-sm-3
          q-card-section
            .text-caption.text-grey-7 Активных позиций
            .text-h6 {{ summary.totalActive }}
        q-card.mp-card.col-12.col-sm-3
          q-card-section
            .text-caption.text-grey-7 КУ с движением
            .text-h6 {{ summary.kuCount }}
        q-card.mp-card.col-12.col-sm-3
          q-card-section
            .text-caption.text-grey-7 Товарных позиций в обороте
            .text-h6 {{ summary.skuCount }}
        q-card.mp-card.col-12.col-sm-3
          q-card-section
            .text-caption.text-grey-7 Списано (накопительно)
            .text-h6 {{ summary.writtenOff }}

      WarehouseSummaryGrid(:rows='warehouseRows')

    q-tab-panel.q-px-none(name='flow')
      .row.q-col-gutter-md.q-mb-md
        q-card.mp-card.col-12.col-sm-3
          q-card-section
            .text-caption.text-grey-7 Маркировок за период
            .text-h6 {{ flow.labeled }}
        q-card.mp-card.col-12.col-sm-3
          q-card-section
            .text-caption.text-grey-7 Выдач пайщикам
            .text-h6 {{ flow.issued }}
        q-card.mp-card.col-12.col-sm-3
          q-card-section
            .text-caption.text-grey-7 Возвратов на склад
            .text-h6 {{ flow.returned }}
        q-card.mp-card.col-12.col-sm-3
          q-card-section
            .text-caption.text-grey-7 Списаний
            .text-h6 {{ flow.writtenOff }}

      q-table.mp-card(
        :rows='topProducts'
        :columns='topColumns'
        row-key='sku'
        flat
        bordered
        dense
        :pagination='{ rowsPerPage: 10 }'
        :rows-per-page-options='[10, 25, 50]'
        binary-state-sort
      )
        template(#top)
          .text-subtitle1 Топ позиций по обороту
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import type { QTableProps } from 'quasar'
import { Zeus } from '@coopenomics/sdk'
import { FailAlert } from 'src/shared/api'
import {
  WarehouseSummaryGrid,
  type WarehouseRow,
} from 'src/widgets/Marketplace/WarehouseSummaryGrid'
import { listAllInventory, type MarketplaceInventoryItemView } from '../api'

const tab = ref<'warehouse' | 'flow'>('warehouse')
const items = ref<MarketplaceInventoryItemView[]>([])
const loading = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    items.value = await listAllInventory({})
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить сводный склад')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

interface BucketKey {
  ku: string
  sku: string
  title: string
}

const summary = computed(() => {
  const kus = new Set<string>()
  const skus = new Set<string>()
  let active = 0
  let writtenOff = 0
  for (const row of items.value) {
    kus.add(row.braname)
    skus.add(row.product_name_snapshot)
    if (row.status === Zeus.MarketplaceInventoryStatus.WRITTEN_OFF) writtenOff += row.quantity_per_label
    else active += row.quantity_per_label
  }
  return {
    totalActive: active,
    writtenOff,
    kuCount: kus.size,
    skuCount: skus.size,
  }
})

const warehouseRows = computed<WarehouseRow[]>(() => {
  const buckets = new Map<string, { key: BucketKey; in: number; out: number; balance: number }>()
  for (const row of items.value) {
    const k = `${row.braname}::${row.product_name_snapshot}`
    const b = buckets.get(k) ?? {
      key: { ku: row.braname, sku: row.product_name_snapshot, title: row.product_name_snapshot },
      in: 0,
      out: 0,
      balance: 0,
    }
    const qty = row.quantity_per_label
    if (
      row.status === Zeus.MarketplaceInventoryStatus.LABELED ||
      row.status === Zeus.MarketplaceInventoryStatus.RETURNED
    ) {
      b.in += qty
      b.balance += qty
    } else if (row.status === Zeus.MarketplaceInventoryStatus.ISSUED) {
      b.out += qty
    } else if (row.status === Zeus.MarketplaceInventoryStatus.WRITTEN_OFF) {
      b.in += qty
      b.out += qty
    }
    buckets.set(k, b)
  }
  return [...buckets.values()].map((b) => ({
    sku: b.key.sku,
    title: b.key.title,
    pvz: b.key.ku,
    incoming: b.in,
    outgoing: b.out,
    balance: b.balance,
    unit: 'шт',
  }))
})

const flow = computed(() => {
  let labeled = 0
  let issued = 0
  let returned = 0
  let writtenOff = 0
  for (const row of items.value) {
    const qty = row.quantity_per_label
    if (row.status === Zeus.MarketplaceInventoryStatus.LABELED) labeled += qty
    if (row.status === Zeus.MarketplaceInventoryStatus.ISSUED) issued += qty
    if (row.status === Zeus.MarketplaceInventoryStatus.RETURNED) returned += qty
    if (row.status === Zeus.MarketplaceInventoryStatus.WRITTEN_OFF) writtenOff += qty
  }
  return { labeled, issued, returned, writtenOff }
})

const topProducts = computed(() => {
  const totals = new Map<string, { sku: string; turnover: number; ku: Set<string> }>()
  for (const row of items.value) {
    const entry =
      totals.get(row.product_name_snapshot) ??
      { sku: row.product_name_snapshot, turnover: 0, ku: new Set<string>() }
    entry.turnover += row.quantity_per_label
    entry.ku.add(row.braname)
    totals.set(row.product_name_snapshot, entry)
  }
  return [...totals.values()]
    .map((e) => ({ sku: e.sku, turnover: e.turnover, ku_count: e.ku.size }))
    .sort((a, b) => b.turnover - a.turnover)
    .slice(0, 10)
})

const topColumns: QTableProps['columns'] = [
  { name: 'sku', label: 'Позиция', field: 'sku', align: 'left', sortable: true },
  { name: 'turnover', label: 'Оборот, ед.', field: 'turnover', align: 'right', sortable: true },
  { name: 'ku_count', label: 'КУ', field: 'ku_count', align: 'right', sortable: true },
]
</script>
