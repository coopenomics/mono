<script setup lang="ts">
import { computed } from 'vue';
import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

/**
 * Read-only таблица сверки позиций акта приёмки: что и сколько фактически
 * принято, по какой цене и на какую сумму. Используется в диалогах подписи
 * поставщика и председателя — обе стороны видят одинаковую сверку перед
 * подписью (у председателя — строго на чтение, факт уже зафиксирован).
 */

export interface ReceptionLineRow {
  product_name: string | null;
  fact_quantity: number;
  unit_of_measure: string | null;
  order_unit_size: string | null;
  fact_unit_price: string | null;
}

const props = defineProps<{
  rows: ReceptionLineRow[];
}>();

function unitShort(row: ReceptionLineRow): string {
  return marketplaceOrderUnitLabel(row.unit_of_measure, row.order_unit_size);
}

function lineSum(row: ReceptionLineRow): number {
  const price = Number.parseFloat(row.fact_unit_price ?? '0');
  return Number.isFinite(price) ? row.fact_quantity * price : 0;
}

const total = computed(() => props.rows.reduce((acc, r) => acc + lineSum(r), 0));
</script>

<template lang="pug">
.mp-reception-lines
  .mp-reception-lines__head
    .mp-reception-lines__cell.mp-reception-lines__cell--title Позиция
    .mp-reception-lines__cell.mp-reception-lines__cell--num Кол-во
    .mp-reception-lines__cell.mp-reception-lines__cell--num Цена/ед.
    .mp-reception-lines__cell.mp-reception-lines__cell--num Сумма

  .mp-reception-lines__row(v-for='(row, i) in rows', :key='i')
    .mp-reception-lines__cell.mp-reception-lines__cell--title {{ row.product_name || 'Товар по предложению' }}
    .mp-reception-lines__cell.mp-reception-lines__cell--num {{ row.fact_quantity }} {{ unitShort(row) }}
    .mp-reception-lines__cell.mp-reception-lines__cell--num {{ formatAsset2Digits(row.fact_unit_price ?? '0') }} ₽
    .mp-reception-lines__cell.mp-reception-lines__cell--num {{ formatAsset2Digits(String(lineSum(row))) }} ₽

  .mp-reception-lines__total
    .mp-reception-lines__cell.mp-reception-lines__cell--title Итого
    .mp-reception-lines__cell.mp-reception-lines__cell--num.mp-reception-lines__cell--strong {{ formatAsset2Digits(String(total)) }} ₽
</template>

<style scoped lang="scss">
.mp-reception-lines {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  overflow: hidden;

  &__head,
  &__row,
  &__total {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: var(--p-2, 8px);
    padding: var(--p-2, 8px) var(--p-3, 12px);
    align-items: center;
  }

  &__head {
    background: var(--p-surface-2, var(--p-surface));
    font-size: var(--p-fs-body-sm, 13px);
    font-weight: 600;
    color: var(--p-ink-2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &__row {
    border-top: 1px solid var(--p-line);
    font-size: var(--p-fs-body, 14px);
    color: var(--p-ink);
  }

  &__total {
    border-top: 1px solid var(--p-line);
    background: var(--p-surface-2, var(--p-surface));
    font-weight: 600;
  }

  &__cell {
    min-width: 0;

    &--title {
      overflow-wrap: anywhere;
    }

    &--num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    &--strong {
      color: var(--p-ink);
    }
  }
}

@media (max-width: 768px) {
  .mp-reception-lines {
    &__head {
      display: none;
    }

    &__row,
    &__total {
      grid-template-columns: 1fr 1fr;
      row-gap: var(--p-1, 4px);
    }

    &__cell--title {
      grid-column: 1 / -1;
      font-weight: 600;
    }
  }
}
</style>
