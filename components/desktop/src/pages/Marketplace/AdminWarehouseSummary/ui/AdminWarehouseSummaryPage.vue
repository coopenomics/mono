<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { debounce } from 'quasar'
import { Zeus } from '@coopenomics/sdk'
import { FailAlert } from 'src/shared/api'
import { EmptyState, TableSkeleton } from 'src/shared/ui/base'
import type { TableSkeletonColumn } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'
import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts/marketplace-units'
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace'
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

// Realtime вместо кнопки «Обновить»: сводку двигают приёмки (акт →
// ACCEPTED_TO_COOP), выдачи (заказ → RECEIVED) и исполненные списания.
// Председатель получает служебный канал персонала КУ по праву admin —
// сигналы всех участков приходят без фильтра.
const reloadLive = debounce(() => {
  if (loading.value) return
  void load()
}, 400)
useMarketplaceRealtime(
  {
    MarketplaceAplReceptionStatusChangedEvent: () => reloadLive(),
    MarketplaceOrderStatusChangedEvent: () => reloadLive(),
    MarketplaceWriteoffStatusChangedEvent: () => reloadLive(),
  },
  { onResync: () => reloadLive() },
)

onMounted(() => {
  void load()
})

// Расход со склада = имущество, физически покинувшее КУ: выдано пайщику (ISSUED)
// либо списано (WRITTEN_OFF). Остаток = приход − расход. Приход = всё, что когда-
// либо оприходовано на КУ (любой статус — каждая запись склада это одна приёмка).
function isOutgoing(status: MarketplaceInventoryItemView['status']): boolean {
  return (
    status === Zeus.MarketplaceInventoryStatus.ISSUED ||
    status === Zeus.MarketplaceInventoryStatus.WRITTEN_OFF
  )
}

interface Bucket {
  key: string
  title: string
  pvzName: string | null
  pvzAddress: string | null
  pvzBraname: string
  unit: string
  incoming: number
  outgoing: number
}

// Группируем по паре (пункт выдачи × позиция): на сводном складе кооператива одна
// и та же позиция может лежать на разных КУ — это разные строки склада.
const buckets = computed<Bucket[]>(() => {
  const map = new Map<string, Bucket>()
  for (const row of items.value) {
    const k = `${row.braname}::${row.product_name_snapshot}`
    const b =
      map.get(k) ??
      ({
        key: k,
        title: row.product_name_snapshot,
        pvzName: row.delivery_point_name ?? null,
        pvzAddress: row.delivery_point_address ?? null,
        pvzBraname: row.braname,
        unit: marketplaceOrderUnitLabel(row.unit_of_measure, row.order_unit_size),
        incoming: 0,
        outgoing: 0,
      } satisfies Bucket)
    b.incoming += row.quantity_per_label
    if (isOutgoing(row.status)) b.outgoing += row.quantity_per_label
    map.set(k, b)
  }
  return [...map.values()]
})

const warehouseRows = computed<WarehouseRow[]>(() =>
  buckets.value.map((b) => ({
    key: b.key,
    title: b.title,
    pvzName: b.pvzName,
    pvzAddress: b.pvzAddress,
    pvzBraname: b.pvzBraname,
    unit: b.unit,
    incoming: b.incoming,
    outgoing: b.outgoing,
    balance: b.incoming - b.outgoing,
  })),
)

// Топ позиций по обороту: те же пары (позиция × КУ), отсортированные по объёму
// прошедшего через склад имущества. Аналитический срез — какие позиции на каких
// пунктах выдачи дают основной оборот.
const topRows = computed(() =>
  [...buckets.value]
    .map((b) => ({
      key: b.key,
      title: b.title,
      pvzName: b.pvzName?.trim() || b.pvzBraname,
      pvzAddress: b.pvzAddress,
      unit: b.unit,
      turnover: b.incoming,
    }))
    .sort((a, b) => b.turnover - a.turnover)
    .slice(0, 10),
)

// Колонки скелетона вкладки «Топ позиций» — повторяют шапку реальной таблицы.
const topSkeletonColumns: TableSkeletonColumn[] = [
  { label: '№', class: 'col-rank' },
  { label: 'Позиция', class: 'col-product' },
  { label: 'Пункт выдачи', class: 'col-pvz' },
  { label: 'Оборот, ед.', class: 'col-num' },
]
</script>

<template lang="pug">
q-page.warehouse-summary(role='region', aria-label='Сводный склад кооператива')
  PageHint(storage-key='mp:admin-warehouse-summary:banner-dismissed')
    | Сводный обзор склада и оборота по всем пунктам выдачи кооператива. Только для
    | чтения — операции выполняются на столах ПВЗ.

  q-tabs.warehouse-summary__tabs(
    v-model='tab',
    dense,
    align='left',
    active-color='primary',
    indicator-color='primary',
    narrow-indicator,
    no-caps
  )
    q-tab(name='warehouse', label='Сводный склад')
    q-tab(name='flow', label='Топ позиций по обороту')

  q-separator

  q-tab-panels.warehouse-summary__panels(v-model='tab', animated, keep-alive)
    q-tab-panel.q-px-none(name='warehouse')
      WarehouseSummaryGrid(:rows='warehouseRows', :loading='loading')

    q-tab-panel.q-px-none(name='flow')
      TableSkeleton(v-if='loading && !topRows.length', :columns='topSkeletonColumns')

      .table-wrap(v-else-if='topRows.length')
        .table-scroll
          table.table.warehouse-summary__top
            thead
              tr
                th.col-rank №
                th.col-product Позиция
                th.col-pvz Пункт выдачи
                th.col-num Оборот, ед.
            tbody
              tr(v-for='(row, i) in topRows', :key='row.key')
                td.col-rank {{ i + 1 }}
                td.col-product.warehouse-summary__product {{ row.title }}
                td.col-pvz
                  .warehouse-summary__pvz
                    span.warehouse-summary__pvz-name {{ row.pvzName }}
                    span.warehouse-summary__pvz-addr(v-if='row.pvzAddress') {{ row.pvzAddress }}
                td.col-num
                  strong {{ row.turnover }}
                  |  {{ row.unit }}

      EmptyState(
        v-else,
        title='Оборота пока нет',
        body='Здесь появится рейтинг позиций по объёму, прошедшему через пункты выдачи.'
      )
        template(#icon)
          q-icon(name='leaderboard', size='48px')
</template>

<style scoped lang="scss">
.warehouse-summary {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}

.table-scroll {
  overflow-x: auto;
}

.warehouse-summary__top {
  table-layout: fixed;
  min-width: 760px;
}

.col-rank {
  width: 48px;
  text-align: right;
}
.col-product {
  width: 280px;
}
.col-pvz {
  width: 320px;
}
.col-num {
  width: 132px;
  text-align: right;
  white-space: nowrap;
}

.warehouse-summary__product {
  overflow-wrap: anywhere;
}

.warehouse-summary__pvz {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.warehouse-summary__pvz-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.warehouse-summary__pvz-addr {
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm, 13px);
  overflow-wrap: anywhere;
}

@media (max-width: 768px) {
  .warehouse-summary {
    padding: var(--p-4, 16px);
  }
}
</style>
