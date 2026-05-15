<template>
  <q-table
    class="mp-warehouse-grid mp-admin-dense"
    :rows="filteredRows"
    :columns="columns"
    row-key="sku"
    dense
    flat
    bordered
    :pagination="{ rowsPerPage: 50 }"
    :rows-per-page-options="[25, 50, 100, 0]"
    binary-state-sort
  >
    <template #top>
      <div class="row q-gutter-md items-center full-width">
        <div class="text-subtitle1">Сводный склад кооператива</div>
        <q-space />
        <q-input
          v-model="filter"
          outlined
          dense
          debounce="200"
          placeholder="Поиск по SKU / названию"
          style="min-width: 280px"
        >
          <template #append><q-icon name="search" /></template>
        </q-input>
      </div>
    </template>

    <template #body-cell-balance="props">
      <q-td :props="props" :class="balanceClass(props.row.balance)">
        <strong>{{ props.row.balance }}</strong>
      </q-td>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { ref, computed, type PropType } from 'vue'
import type { QTableProps } from 'quasar'

export interface WarehouseRow {
  sku: string
  title: string
  unit: string
  incoming: number  // приход на КУ
  outgoing: number  // расход (выдано / отгружено)
  balance: number   // остаток на КУ (in - out)
  pvz?: string
}

const props = defineProps({
  rows: { type: Array as PropType<WarehouseRow[]>, required: true },
})

const filter = ref('')

// КУ работает транзитом: пришло → ушло. Колонка «статус достаточности»
// удалена — это не торговая точка с минимальными остатками; transient-balance
// и так виден в колонке «Остаток».
const columns: QTableProps['columns'] = [
  { name: 'sku',      label: 'SKU',     field: 'sku',      align: 'left',  sortable: true },
  { name: 'title',    label: 'Позиция', field: 'title',    align: 'left',  sortable: true },
  { name: 'pvz',      label: 'ПВЗ',     field: 'pvz',      align: 'left' },
  { name: 'incoming', label: 'Приход',  field: 'incoming', align: 'right', sortable: true },
  { name: 'outgoing', label: 'Расход',  field: 'outgoing', align: 'right', sortable: true },
  { name: 'balance',  label: 'Остаток', field: 'balance',  align: 'right', sortable: true },
  { name: 'unit',     label: 'Ед.',     field: 'unit',     align: 'left' },
]

// Подсветка остатка остаётся (визуально: 0 — приглушённо, >0 — нейтрально),
// но это не «статус достаточности».
function balanceClass(b: number) {
  return b > 0 ? '' : 'text-grey-6'
}

const filteredRows = computed(() => {
  const f = filter.value.trim().toLowerCase()
  if (!f) return props.rows
  return props.rows.filter((r) =>
    r.sku.toLowerCase().includes(f) || r.title.toLowerCase().includes(f)
  )
})

defineExpose({ filteredRows })
</script>
