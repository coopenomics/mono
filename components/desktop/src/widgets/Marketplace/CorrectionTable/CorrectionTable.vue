<template lang="pug">
//- Сверка — таблица с заголовком колонок, а не строки через точки: план,
//- принято и место читаются столбцами, поля факта стоят под своими
//- заголовками и не носят подписи внутри себя. Та же сетка, что у шага
//- оприходования в приёмке. Без q-table — канон .table / Base*.
.correction-table(:class='{ "correction-table--selectable": selectable }', :style='{ "--ct-cols": gridColumns }')
  .correction-table__cols
    span(v-if='selectable')
    span Позиция
    span План
    span(v-if='hasAvailable') Принято
    span(v-if='hasLocation') Место
    span Выдать
    span(v-if='hasPrice') Цена
    span Сверка

  .correction-table__row(
    v-for='r in enrichedRows',
    :key='r.sku',
    :class='{ "correction-table__row--off": isOff(r) }'
  )
    span.correction-table__check(v-if='selectable')
      BaseCheckbox(
        :model-value='r.included !== false',
        :disabled='r.noStock',
        @update:model-value='(v) => emit("toggle", { sku: r.sku, included: !!v })'
      )
      q-tooltip(v-if='r.noStock') Нет на складе — выдать нечего

    .correction-table__cell.correction-table__cell--title {{ r.title }}
    .correction-table__cell.correction-table__cell--num(data-label='План') {{ r.expected }} {{ r.unit }}
    .correction-table__cell.correction-table__cell--num(v-if='hasAvailable', data-label='Принято')
      template(v-if='r.available !== undefined') {{ r.available }} {{ r.unit }}
      template(v-else) —
    .correction-table__cell(v-if='hasLocation', data-label='Место') {{ r.location || '—' }}
    .correction-table__cell(data-label='Выдать')
      BaseInput.field-flush(
        :model-value='r.fact',
        type='number',
        :min='0',
        :max='factCeiling(r)',
        :step='stepFor(r)',
        :disabled='isOff(r)',
        :suffix='r.unit',
        aria-label='Выдать, количество',
        @update:model-value='(v) => onFactInput(r, v)'
      )
    .correction-table__cell(v-if='hasPrice', data-label='Цена')
      BaseInput.field-flush(
        :model-value='r.factPrice',
        type='number',
        :min='0',
        :max='r.maxPrice',
        :disabled='isOff(r)',
        :suffix='r.packaged ? "₽/упак." : "₽/ед."',
        :aria-label='r.packaged ? "Цена за упаковку" : "Цена за единицу"',
        @update:model-value='(v) => onPriceInput(r, v)'
      )
    .correction-table__cell(data-label='Сверка')
      BaseBadge(:variant='statusVariant(r)') {{ statusLabel(r) }}

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
import type { CorrectionRow } from './CorrectionTable.types';

const props = defineProps({
  rows: { type: Array as PropType<CorrectionRow[]>, required: true },
  selectable: { type: Boolean, default: false },
});

const emit = defineEmits<{
  (e: 'change', payload: { sku: string; fact: number; factPrice?: number }): void;
  (e: 'toggle', payload: { sku: string; included: boolean }): void;
}>();

const hasPrice = computed(() => props.rows.some((r) => r.expectedPrice !== undefined));
// Колонки «Принято» и «Место» есть только там, где есть данные: на выдаче они
// есть всегда, на других сверках их нет — пустой столбец не держим.
const hasAvailable = computed(() => props.rows.some((r) => r.available !== undefined));
const hasLocation = computed(() => props.rows.some((r) => Boolean(r.location)));

// Треки сетки собираются из тех колонок, что реально выведены: заголовок и
// строки пропускают одни и те же, иначе ячейка попадала бы в чужую ширину.
const gridColumns = computed(() =>
  [
    props.selectable ? '28px' : null,
    'minmax(160px, 1fr)',
    '112px',
    hasAvailable.value ? '112px' : null,
    // «Бокс BX-0003 · A-03» — целиком в строку.
    hasLocation.value ? '156px' : null,
    '160px',
    hasPrice.value ? '128px' : null,
    // Самый длинный бейдж — «Больше принятого».
    '136px',
  ]
    .filter(Boolean)
    .join(' '),
);

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

// Шаг ввода количества: упаковка и штука неделимы (1), вес/объём — дробный
// шаг 0.001 (граммы/миллилитры), чтобы браузер не блокировал дробное значение.
function stepFor(r: EnrichedRow): string {
  if (r.packaged) return '1';
  return r.unit === 'шт' || r.unit === 'шт.' ? '1' : '0.001';
}

function toNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function onFactInput(r: EnrichedRow, raw: unknown): void {
  let fact = toNumber(raw);
  if (fact < 0) fact = 0;
  // Упаковку не дробим: 1,5 упаковки не существует ни физически, ни на цепи
  // (контракт требует кратности количества размеру упаковки).
  if (r.packaged) fact = Math.floor(fact);
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
// Сетка одна на заголовок и строки; колонок столько, сколько данных есть.
// Ширины фиксированы, растягивается только «Позиция».
.correction-table {
  $gap: var(--p-2, 8px);

  display: flex;
  flex-direction: column;

  // Треки приходят из компонента (--ct-cols): их состав зависит от данных.
  &__cols,
  &__row {
    display: grid;
    grid-template-columns: var(--ct-cols);
    gap: $gap;
    align-items: center;
  }

  &__cols {
    padding-bottom: var(--p-2, 8px);
    border-bottom: 1px solid var(--p-line);
    font-size: var(--p-fs-meta, 12px);
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--p-ink-3);
  }

  &__row {
    padding: var(--p-2, 8px) 0;
    border-bottom: 1px solid var(--p-line);

    &--off {
      opacity: 0.5;
    }
  }

  &__check {
    display: inline-flex;
    align-items: center;
  }

  &__cell {
    min-width: 0;
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-2);
    font-variant-numeric: tabular-nums;

    &--title {
      font-size: var(--p-fs-body, 14px);
      color: var(--p-ink);
      overflow-wrap: break-word;
    }

    &--num {
      white-space: nowrap;
    }

    :deep(.base-input) {
      width: 100%;
    }
  }

  &__summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
    padding-top: var(--p-3, 12px);
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

// Узкий экран: заголовок колонок уходит, строка складывается в карточку —
// галочка и название первой линией, дальше ячейки парами во всю ширину,
// каждая подписана сама (data-label). Сетка здесь не годится: авто-
// размещение сажало ячейки в узкую колонку галочки, и они наезжали друг
// на друга (09.09.2026).
@media (max-width: 900px) {
  .correction-table {
    &__cols {
      display: none;
    }

    &__row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--p-2, 8px) var(--p-3, 12px);
    }

    &__check {
      flex: 0 0 auto;
      min-height: 24px;
    }

    // Базис больше половины — следующая ячейка всегда уходит на новую линию.
    &__cell--title {
      flex: 1 1 60%;
      min-width: 0;
    }

    &__cell:not(&__cell--title) {
      flex: 1 1 calc(50% - var(--p-3, 12px));
      min-width: 140px;

      &::before {
        content: attr(data-label);
        display: block;
        margin-bottom: 2px;
        font-size: var(--p-fs-meta, 12px);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--p-ink-3);
      }
    }
  }
}
</style>
