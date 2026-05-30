<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import type { QTableProps } from 'quasar'
import { Zeus } from '@coopenomics/sdk'
import { FailAlert } from 'src/shared/api'
import { BaseButton } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'
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

<template lang="pug">
q-page.warehouse-summary(role="region", aria-label="Сводный склад кооператива")
  PageHint(storage-key="mp:admin-warehouse-summary:banner-dismissed")
    | Сводный обзор склада и потока заказов по всем пунктам выдачи кооператива. Только для чтения — операции выполняются на столах ПВЗ.

  .warehouse-summary__toolbar
    q-space
    BaseButton(variant="ghost", :loading="loading", @click="load")
      template(#icon-left)
        q-icon(name="refresh", size="18px")
      | Обновить

  q-tabs.warehouse-summary__tabs(
    v-model="tab",
    dense,
    align="left",
    active-color="primary",
    indicator-color="primary",
    narrow-indicator,
    no-caps
  )
    q-tab(name="warehouse", label="Сводный склад")
    q-tab(name="flow", label="Поток заказов и поставок")

  q-separator

  q-tab-panels.warehouse-summary__panels(v-model="tab", animated, keep-alive)
    q-tab-panel.q-px-none(name="warehouse")
      .warehouse-summary__stats
        .kpi.kpi--accent
          .kpi__head
            span.kpi__eyebrow Активных позиций
          .kpi__val {{ summary.totalActive }}
        .kpi
          .kpi__head
            span.kpi__eyebrow КУ с движением
          .kpi__val {{ summary.kuCount }}
        .kpi
          .kpi__head
            span.kpi__eyebrow Товарных позиций в обороте
          .kpi__val {{ summary.skuCount }}
        .kpi
          .kpi__head
            span.kpi__eyebrow Списано (накопительно)
          .kpi__val {{ summary.writtenOff }}

      WarehouseSummaryGrid(:rows="warehouseRows")

    q-tab-panel.q-px-none(name="flow")
      .warehouse-summary__stats
        .kpi
          .kpi__head
            span.kpi__eyebrow Маркировок за период
          .kpi__val {{ flow.labeled }}
        .kpi
          .kpi__head
            span.kpi__eyebrow Выдач пайщикам
          .kpi__val {{ flow.issued }}
        .kpi
          .kpi__head
            span.kpi__eyebrow Возвратов на склад
          .kpi__val {{ flow.returned }}
        .kpi
          .kpi__head
            span.kpi__eyebrow Списаний
          .kpi__val {{ flow.writtenOff }}

      q-table.warehouse-summary__table(
        :rows="topProducts",
        :columns="topColumns",
        row-key="sku",
        flat,
        bordered,
        :pagination="{ rowsPerPage: 10 }",
        :rows-per-page-options="[10, 25, 50]",
        binary-state-sort
      )
        template(#top)
          .t-h3 Топ позиций по обороту
</template>

<style scoped lang="scss">
.warehouse-summary {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__toolbar {
    display: flex;
    align-items: center;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--p-3, 12px);
    margin-bottom: var(--p-4, 16px);
  }
}

@media (max-width: 768px) {
  .warehouse-summary {
    padding: var(--p-4, 16px);
  }
}
</style>
