<template>
  <div class="mp-correction-table">
    <!-- Desktop / planshet — обычная таблица -->
    <q-table
      v-if="!compact"
      class="mp-correction-table__grid"
      :rows="enrichedRows"
      :columns="columns"
      row-key="sku"
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
            input-class="text-right mp-correction-table__fact-input"
            @update:model-value="emit('change', { sku: props.row.sku, fact: props.row.fact, factPrice: props.row.factPrice })"
          />
        </q-td>
      </template>

      <template #body-cell-factPrice="props">
        <q-td :props="props">
          <q-input
            v-model.number="props.row.factPrice"
            type="number"
            dense
            outlined
            input-class="text-right mp-correction-table__fact-input"
            @update:model-value="onPriceChange(props.row)"
          />
        </q-td>
      </template>

      <template #body-cell-status="props">
        <q-td :props="props">
          <span class="mp-status-chip" :class="`mp-status-chip--${statusKind(props.row)}`">
            {{ statusLabel(props.row) }}
          </span>
        </q-td>
      </template>
    </q-table>

    <!-- Mobile (xs) — карточный вид, факт это крупное touch-friendly поле -->
    <div v-else class="mp-correction-table__cards">
      <div
        v-for="r in enrichedRows"
        :key="r.sku"
        class="mp-card mp-correction-table__card"
      >
        <div class="mp-correction-table__card-head">
          <div>
            <div class="mp-correction-table__card-title">{{ r.title }}</div>
            <div class="mp-correction-table__card-sku">SKU · {{ r.sku }}</div>
          </div>
          <span class="mp-status-chip" :class="`mp-status-chip--${statusKind(r)}`">
            {{ statusLabel(r) }}
          </span>
        </div>

        <div class="mp-correction-table__card-grid">
          <div>
            <div class="mp-correction-table__card-label">План</div>
            <div class="mp-correction-table__card-value">{{ r.expected }} {{ r.unit }}</div>
          </div>
          <div v-if="hasAvailable">
            <div class="mp-correction-table__card-label">Принято</div>
            <div class="mp-correction-table__card-value">{{ r.available ?? '—' }} {{ r.unit }}</div>
          </div>
          <div>
            <div class="mp-correction-table__card-label">Факт</div>
            <q-input
              v-model.number="r.fact"
              type="number"
              outlined
              dense
              :suffix="r.unit"
              class="mp-correction-table__fact-input--mobile"
              @update:model-value="emit('change', { sku: r.sku, fact: r.fact, factPrice: r.factPrice })"
            />
          </div>
          <div>
            <div class="mp-correction-table__card-label">Δ</div>
            <div :class="['mp-correction-table__card-value', deltaClass(r)]">
              {{ r.delta > 0 ? '+' : '' }}{{ r.delta }}
            </div>
          </div>
        </div>

        <div v-if="hasPrice" class="mp-correction-table__card-price">
          <div class="mp-correction-table__card-label">Цена за единицу</div>
          <q-input
            v-model.number="r.factPrice"
            type="number"
            outlined
            dense
            class="mp-correction-table__fact-input--mobile"
            @update:model-value="onPriceChange(r)"
          />
        </div>
      </div>
    </div>

    <!-- Footer summary (одинаковый и для таблицы, и для карточек) -->
    <div class="mp-correction-table__summary">
      <div class="mp-correction-table__summary-count">
        Итого позиций: {{ enrichedRows.length }}
      </div>
      <div class="mp-correction-table__summary-chips">
        <span v-if="overStockCount" class="mp-status-chip mp-status-chip--error">Больше принятого · {{ overStockCount }}</span>
        <span class="mp-status-chip mp-status-chip--success">Совпадает · {{ matchCount }}</span>
        <span class="mp-status-chip mp-status-chip--warning">Недостача · {{ shortCount }}</span>
        <span class="mp-status-chip mp-status-chip--info">Избыток · {{ overCount }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useQuasar, type QTableProps } from 'quasar'

export interface CorrectionRow {
  sku: string
  title: string
  unit: string
  expected: number   // план (заказ), количество
  fact: number       // факт (поступление/выдача), количество
  /**
   * Принято на склад и не выдано — потолок факта при выдаче. Если задано,
   * fact > available подсвечивается ошибкой «Больше принятого»: выдать со
   * склада больше, чем физически есть, нельзя.
   */
  available?: number
  expectedPrice?: number  // цена за единицу по заказу (план)
  factPrice?: number       // фактическая цена за единицу (редактируется оператором)
}

const props = defineProps({
  rows: { type: Array as PropType<CorrectionRow[]>, required: true },
})

const emit = defineEmits<{
  (e: 'change', payload: { sku: string; fact: number; factPrice?: number }): void
}>()

const $q = useQuasar()
const compact = computed(() => $q.screen.lt.sm)

// Режим правки цены включается, если хотя бы у одной строки задана цена.
const hasPrice = computed(() => props.rows.some((r) => r.expectedPrice !== undefined))
// Колонка «Принято» (склад) показывается, если потолок задан хотя бы у одной строки.
const hasAvailable = computed(() => props.rows.some((r) => r.available !== undefined))

const enrichedRows = computed(() =>
  props.rows.map((r) => ({
    ...r,
    delta: r.fact - r.expected,
    overStock: r.available !== undefined && r.fact > r.available,
  }))
)

const columns = computed<QTableProps['columns']>(() => {
  const base: NonNullable<QTableProps['columns']> = [
    { name: 'sku',      label: 'SKU',     field: 'sku',      align: 'left' },
    { name: 'title',    label: 'Позиция', field: 'title',    align: 'left' },
    { name: 'expected', label: 'План',    field: 'expected', align: 'right' },
  ]
  if (hasAvailable.value) {
    base.push({ name: 'available', label: 'Принято', field: 'available', align: 'right' })
  }
  base.push(
    { name: 'fact',     label: 'Факт',    field: 'fact',     align: 'right' },
    { name: 'delta',    label: 'Δ',       field: 'delta',    align: 'right' },
    { name: 'unit',     label: 'Ед.',     field: 'unit',     align: 'left' },
  )
  if (hasPrice.value) {
    base.push({ name: 'factPrice', label: 'Цена/ед.', field: 'factPrice', align: 'right' })
  }
  base.push({ name: 'status', label: 'Статус', field: 'sku', align: 'center' })
  return base
})

function onPriceChange(row: CorrectionRow): void {
  emit('change', { sku: row.sku, fact: row.fact, factPrice: row.factPrice })
}

type StatusKind = 'success' | 'warning' | 'info' | 'error'

type EnrichedRow = CorrectionRow & { delta: number; overStock: boolean }

function statusLabel(r: EnrichedRow): string {
  if (r.overStock) return 'Больше принятого'
  if (r.delta === 0) return 'Совпадает'
  if (r.delta < 0)  return 'Недостача'
  return 'Избыток'
}

function statusKind(r: EnrichedRow): StatusKind {
  if (r.overStock) return 'error'
  if (r.delta === 0) return 'success'
  if (r.delta < 0)  return 'warning'
  return 'info'
}

function deltaClass(r: EnrichedRow): string {
  if (r.overStock) return 'text-negative'
  if (r.delta === 0) return 'text-positive'
  if (r.delta < 0)  return 'text-warning'
  return 'text-info'
}

const matchCount = computed(() => enrichedRows.value.filter((r) => !r.overStock && r.delta === 0).length)
const shortCount = computed(() => enrichedRows.value.filter((r) => !r.overStock && r.delta < 0).length)
const overCount  = computed(() => enrichedRows.value.filter((r) => !r.overStock && r.delta > 0).length)
const overStockCount = computed(() => enrichedRows.value.filter((r) => r.overStock).length)
</script>

<style scoped lang="scss">
.mp-correction-table {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__grid {
    background: var(--p-surface);
    border-radius: var(--p-r-md, 12px);

    :deep(td), :deep(th) {
      font-size: var(--p-fs-body, 14px);
    }

    // Поле «факт» не должно быть микроскопическим — даём минимум на ввод
    :deep(.mp-correction-table__fact-input) {
      min-width: 64px;
    }
  }

  &__cards {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__card-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    margin-bottom: var(--p-2, 8px);
  }

  &__card-title {
    font-weight: 500;
    color: var(--p-ink);
  }

  &__card-sku {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
    margin-top: 2px;
  }

  &__card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
    gap: var(--p-3, 12px);
    align-items: end;
  }

  &__card-label {
    font-size: 11px;
    color: var(--p-ink-3);
    text-transform: uppercase;
    letter-spacing: .04em;
    margin-bottom: 4px;
  }

  &__card-value {
    font-size: 17px;
    font-weight: 600;
    color: var(--p-ink);
  }

  &__fact-input--mobile :deep(.q-field__control) {
    min-height: 44px;
  }

  &__summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
    padding-top: var(--p-2, 8px);
    border-top: 1px solid var(--p-line);
  }

  &__summary-count {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__summary-chips {
    display: flex;
    gap: var(--p-2, 8px);
    flex-wrap: wrap;
  }
}
</style>
