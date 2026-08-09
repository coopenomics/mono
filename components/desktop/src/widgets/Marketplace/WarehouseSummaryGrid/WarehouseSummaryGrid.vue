<script setup lang="ts">
import { ref, computed, type PropType } from 'vue'
import { EmptyState, TableSkeleton } from 'src/shared/ui/base'
import type { TableSkeletonColumn } from 'src/shared/ui/base'
import { FilterBar } from 'src/shared/ui/domain'

export interface WarehouseRow {
  key: string
  title: string // Позиция (наименование товара)
  pvzName: string | null // наименование КУ (наименование организации участка)
  pvzAddress: string | null // адрес КУ
  pvzBraname: string // служебное имя участка — fallback для поиска/показа
  unit: string // короткая подпись единицы измерения (шт/кг/л/упак)
  incoming: number // приход на КУ (всё оприходованное)
  outgoing: number // расход (выдано пайщику + списано)
  balance: number // остаток на КУ (приход − расход)
}

const props = defineProps({
  rows: { type: Array as PropType<WarehouseRow[]>, required: true },
  // Флаг первичной загрузки от родителя: пока грузим и строк ещё нет — канон
  // требует скелетон-таблицу, а не мелькающую заглушку «На складе пусто».
  loading: { type: Boolean, default: false },
})

const filter = ref('')

// Колонки скелетона повторяют шапку реальной таблицы (форма не дёргается).
const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Позиция', width: '260px', class: 'col-product' },
  { label: 'Пункт выдачи', width: '300px', class: 'col-pvz' },
  { label: 'Принято', class: 'col-num' },
  { label: 'Выдано', class: 'col-num' },
  { label: 'Остаток', class: 'col-num' },
  { label: 'Ед.', width: '64px', class: 'col-unit' },
]

const filteredRows = computed(() => {
  const f = filter.value.trim().toLowerCase()
  if (!f) return props.rows
  return props.rows.filter((r) =>
    [r.title, r.pvzName, r.pvzAddress, r.pvzBraname]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(f),
  )
})

function pvzTitle(row: WarehouseRow): string {
  return row.pvzName?.trim() || row.pvzBraname
}

defineExpose({ filteredRows })
</script>

<template lang="pug">
.warehouse-grid
  FilterBar.warehouse-grid__filter(
    v-model:search='filter',
    search-placeholder='Поиск: товар, пункт выдачи, адрес',
    hide-reset
  )

  TableSkeleton(
    v-if='loading && !filteredRows.length',
    :columns='skeletonColumns',
    min-width='900px'
  )

  .table-wrap(v-else-if='filteredRows.length')
    .table-scroll
      table.table
        thead
          tr
            th.col-product Позиция
            th.col-pvz Пункт выдачи
            th.col-num Принято
            th.col-num Выдано
            th.col-num Остаток
            th.col-unit Ед.
        tbody
          tr(v-for='row in filteredRows', :key='row.key')
            td.col-product.warehouse-grid__product {{ row.title }}
            td.col-pvz
              .warehouse-grid__pvz
                span.warehouse-grid__pvz-name {{ pvzTitle(row) }}
                span.warehouse-grid__pvz-addr(v-if='row.pvzAddress') {{ row.pvzAddress }}
            td.col-num {{ row.incoming }}
            td.col-num {{ row.outgoing }}
            td.col-num
              strong(:class='row.balance > 0 ? "" : "text-grey-6"') {{ row.balance }}
            td.col-unit {{ row.unit }}

    .table-foot
      span Позиций: {{ filteredRows.length }}

  EmptyState(
    v-else,
    title='На складе пусто',
    body='Здесь появятся принятые на пункты выдачи позиции. Измените поиск, если ожидали увидеть товар.'
  )
    template(#icon)
      q-icon(name='inventory_2', size='48px')
</template>

<style scoped lang="scss">
.warehouse-grid {
  width: 100%;
}

.warehouse-grid__filter {
  margin-bottom: var(--p-3, 12px);
}

.table-scroll {
  overflow-x: auto;
}

// Сумма ширин колонок = min-width: при table-layout:fixed колонки не схлопываются,
// а на узких экранах включается горизонтальный скролл.
.table {
  table-layout: fixed;
  min-width: 900px;
}

.col-product {
  width: 260px;
}
.col-pvz {
  width: 300px;
}
.col-num {
  width: 96px;
  text-align: right;
}
.col-unit {
  width: 64px;
}

.warehouse-grid__product {
  overflow-wrap: anywhere;
}

.warehouse-grid__pvz {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.warehouse-grid__pvz-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.warehouse-grid__pvz-addr {
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm, 13px);
  overflow-wrap: anywhere;
}

</style>
