<template>
  <q-table
    class="mp-correction-table"
    :rows="enrichedRows"
    :columns="columns"
    row-key="sku"
    dense
    flat
    bordered
    hide-bottom
    :pagination="{ rowsPerPage: 0 }"
    :rows-per-page-options="[0]"
  >
    <template #body-cell-delta="props">
      <q-td :props="props" :class="deltaClass(props.row)">
        <strong>{{ props.row.delta > 0 ? '+' : '' }}{{ props.row.delta }}</strong>
      </q-td>
    </template>

    <template #body-cell-fact="props">
      <q-td :props="props">
        <q-input
          v-model.number="props.row.fact"
          type="number"
          dense
          outlined
          input-class="text-right"
          @update:model-value="emit('change', { sku: props.row.sku, fact: props.row.fact })"
        />
      </q-td>
    </template>

    <template #body-cell-status="props">
      <q-td :props="props">
        <q-badge :color="statusColor(props.row)" class="mp-status-badge">
          {{ statusLabel(props.row) }}
        </q-badge>
      </q-td>
    </template>

    <template #bottom>
      <div class="row q-gutter-md items-center q-pa-sm full-width">
        <div class="text-caption text-grey-7">Итого позиций: {{ enrichedRows.length }}</div>
        <q-space />
        <q-chip color="positive" text-color="white" icon="fa-solid fa-check">
          Совпадает: {{ matchCount }}
        </q-chip>
        <q-chip color="warning" text-color="white" icon="fa-solid fa-arrow-trend-down">
          Недостача: {{ shortCount }}
        </q-chip>
        <q-chip color="info" text-color="white" icon="fa-solid fa-arrow-trend-up">
          Избыток: {{ overCount }}
        </q-chip>
      </div>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import type { QTableProps } from 'quasar'

export interface CorrectionRow {
  sku: string
  title: string
  unit: string
  expected: number   // план (заказ)
  fact: number       // факт (поступление)
}

const props = defineProps({
  rows: { type: Array as PropType<CorrectionRow[]>, required: true },
})

const emit = defineEmits<{
  (e: 'change', payload: { sku: string; fact: number }): void
}>()

const enrichedRows = computed(() =>
  props.rows.map((r) => ({ ...r, delta: r.fact - r.expected }))
)

const columns: QTableProps['columns'] = [
  { name: 'sku',      label: 'SKU',     field: 'sku',      align: 'left' },
  { name: 'title',    label: 'Позиция', field: 'title',    align: 'left' },
  { name: 'expected', label: 'План',    field: 'expected', align: 'right' },
  { name: 'fact',     label: 'Факт',    field: 'fact',     align: 'right' },
  { name: 'delta',    label: 'Δ',       field: 'delta',    align: 'right' },
  { name: 'unit',     label: 'Ед.',     field: 'unit',     align: 'left' },
  { name: 'status',   label: 'Статус',  field: 'sku',      align: 'center' },
]

function statusLabel(r: CorrectionRow & { delta: number }): string {
  if (r.delta === 0) return 'Совпадает'
  if (r.delta < 0)  return 'Недостача'
  return 'Избыток'
}

function statusColor(r: CorrectionRow & { delta: number }): string {
  if (r.delta === 0) return 'positive'
  if (r.delta < 0)  return 'warning'
  return 'info'
}

function deltaClass(r: CorrectionRow & { delta: number }): string {
  if (r.delta === 0) return 'text-positive'
  if (r.delta < 0)  return 'text-warning'
  return 'text-info'
}

const matchCount = computed(() => enrichedRows.value.filter((r) => r.delta === 0).length)
const shortCount = computed(() => enrichedRows.value.filter((r) => r.delta < 0).length)
const overCount  = computed(() => enrichedRows.value.filter((r) => r.delta > 0).length)
</script>
