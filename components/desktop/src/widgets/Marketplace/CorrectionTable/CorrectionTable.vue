<template lang="pug">
.correction-table
  //- Тот же паттерн unit-row, что и в приёмке имущества: чекбокс · инфо ·
  //- статус · кол-во/цена. Без q-table — канон .table / Base*.
  .correction-table__unit(
    v-for='r in enrichedRows',
    :key='r.sku',
    :class='{ "correction-table__unit--off": isOff(r) }'
  )
    span.correction-table__check(v-if='selectable')
      BaseCheckbox(
        :model-value='r.included !== false',
        :disabled='r.noStock',
        @update:model-value='(v) => emit("toggle", { sku: r.sku, included: !!v })'
      )
      q-tooltip(v-if='r.noStock') Нет на складе — выдать нечего

    .correction-table__info
      .correction-table__title {{ r.title }}
      .correction-table__meta
        | План {{ r.expected }}×{{ r.unit }}
        template(v-if='r.available !== undefined')
          |  · Принято {{ r.available }}×{{ r.unit }}
        template(v-if='r.shelf')
          |  · Полка {{ r.shelf }}

    BaseBadge.correction-table__status(:variant='statusVariant(r)') {{ statusLabel(r) }}

    .correction-table__fact
      BaseInput(
        :model-value='r.fact',
        type='number',
        label='Кол-во',
        :min='0',
        :max='factCeiling(r)',
        :disabled='isOff(r)',
        :suffix='r.unit',
        @update:model-value='(v) => onFactInput(r, v)'
      )
      BaseInput(
        v-if='hasPrice',
        :model-value='r.factPrice',
        type='number',
        label='Цена/ед.',
        :disabled='isOff(r)',
        @update:model-value='(v) => onPriceInput(r, v)'
      )

  .correction-table__summary
    .correction-table__summary-count Итого позиций: {{ enrichedRows.length }}
    .correction-table__summary-chips
      BaseBadge(v-if='noStockCount', variant='neg') Нет на складе · {{ noStockCount }}
      BaseBadge(v-if='overStockCount', variant='neg') Больше принятого · {{ overStockCount }}
      BaseBadge(variant='pos') Совпадает · {{ matchCount }}
      BaseBadge(variant='warn') Недостача · {{ shortCount }}
      BaseBadge(variant='info') Избыток · {{ overCount }}
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue';
import { BaseBadge, BaseCheckbox, BaseInput } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';

export interface CorrectionRow {
  sku: string;
  title: string;
  unit: string;
  /** План (заказ), количество. */
  expected: number;
  /** Факт (поступление/выдача), количество. */
  fact: number;
  /**
   * Выдавать ли позицию в этой операции (режим `selectable`). Снятая галочка =
   * имущество остаётся на складе, в текущую выдачу не попадает.
   */
  included?: boolean;
  /**
   * Принято на склад и не выдано — потолок факта при выдаче. fact > available
   * → «Больше принятого».
   */
  available?: number;
  /** Полка/полки склада после раскладки. */
  shelf?: string;
  expectedPrice?: number;
  factPrice?: number;
}

const props = defineProps({
  rows: { type: Array as PropType<CorrectionRow[]>, required: true },
  selectable: { type: Boolean, default: false },
});

const emit = defineEmits<{
  (e: 'change', payload: { sku: string; fact: number; factPrice?: number }): void;
  (e: 'toggle', payload: { sku: string; included: boolean }): void;
}>();

const hasPrice = computed(() => props.rows.some((r) => r.expectedPrice !== undefined));

type EnrichedRow = CorrectionRow & { delta: number; overStock: boolean; noStock: boolean };

const enrichedRows = computed<EnrichedRow[]>(() =>
  props.rows.map((r) => ({
    ...r,
    delta: r.fact - r.expected,
    overStock: r.available !== undefined && r.fact > r.available,
    noStock: r.available !== undefined && r.available <= 0,
  })),
);

function isOff(r: EnrichedRow): boolean {
  return props.selectable && r.included === false;
}

function factCeiling(r: EnrichedRow): number | undefined {
  if (r.available !== undefined) return r.available;
  return undefined;
}

function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function onFactInput(r: EnrichedRow, raw: unknown): void {
  let fact = toNumber(raw);
  if (fact < 0) fact = 0;
  const ceiling = factCeiling(r);
  if (ceiling !== undefined && fact > ceiling) fact = ceiling;
  emit('change', { sku: r.sku, fact, factPrice: r.factPrice });
}

function onPriceInput(r: EnrichedRow, raw: unknown): void {
  emit('change', { sku: r.sku, fact: r.fact, factPrice: Math.max(0, toNumber(raw)) });
}

function statusLabel(r: EnrichedRow): string {
  if (r.noStock) return 'Нет на складе';
  if (r.overStock) return 'Больше принятого';
  if (r.delta === 0) return 'Совпадает';
  if (r.delta < 0) return 'Недостача';
  return 'Избыток';
}

function statusVariant(r: EnrichedRow): BaseBadgeVariant {
  if (r.noStock || r.overStock) return 'neg';
  if (r.delta === 0) return 'pos';
  if (r.delta < 0) return 'warn';
  return 'info';
}

const noStockCount = computed(() => enrichedRows.value.filter((r) => r.noStock).length);
const matchCount = computed(
  () => enrichedRows.value.filter((r) => !r.overStock && !r.noStock && r.delta === 0).length,
);
const shortCount = computed(
  () => enrichedRows.value.filter((r) => !r.overStock && !r.noStock && r.delta < 0).length,
);
const overCount = computed(
  () => enrichedRows.value.filter((r) => !r.overStock && !r.noStock && r.delta > 0).length,
);
const overStockCount = computed(() => enrichedRows.value.filter((r) => r.overStock).length);
</script>

<style scoped lang="scss">
.correction-table {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);

  &__unit {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    padding-top: var(--p-2, 8px);
    border-top: 1px solid var(--p-line);

    &:first-child {
      border-top: 0;
      padding-top: 0;
    }

    &--off {
      opacity: 0.5;
    }
  }

  &__check {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
  }

  &__info {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__title {
    font-size: var(--p-fs-body, 14px);
    color: var(--p-ink);
    overflow-wrap: break-word;
  }

  &__meta {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;
  }

  &__status {
    flex: 0 0 auto;
  }

  // Кол-во и Цена/ед. — один ряд, как в приёмке имущества поставщика.
  &__fact {
    flex: 0 0 auto;
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    width: 280px;

    :deep(.base-input) {
      flex: 1 1 0;
      min-width: 0;
    }
  }

  &__summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
    padding-top: var(--p-3, 12px);
    margin-top: var(--p-2, 8px);
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

@media (max-width: 768px) {
  .correction-table {
    &__unit {
      flex-wrap: wrap;
    }

    &__fact {
      width: 100%;
    }

    &__status {
      order: 3;
    }
  }
}
</style>
