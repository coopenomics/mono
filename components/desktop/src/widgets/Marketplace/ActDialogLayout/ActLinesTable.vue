<template lang="pug">
//- Таблица позиций акта — общая для приёмки у оператора, подписи поставщика
//- и выдачи пайщику. Подписи колонок один раз полосой сверху, строки на
//- волосяных линиях, числа по правому краю. Ячейки отдаёт экран слотами
//- `#cell-<key>`; без слота ячейка показывает `row[key]`. Строка с
//- `section: true` — подзаголовок раздела во всю ширину (слот `#section`).
//- На узком экране строка складывается: широкая колонка во всю строку, прочие
//- ячейки парами «подпись над значением».
.act-lines(:style='{ "--act-lines-cols": gridTemplate }')
  .act-lines__row.act-lines__row--head
    span(
      v-for='c in columns',
      :key='c.key',
      :class='{ "act-lines__num": c.align === "right" }'
    ) {{ c.label }}

  template(v-for='row in rows', :key='row.key')
    .act-lines__section(v-if='row.section')
      slot(name='section', :row='row')
    .act-lines__row(v-else, :class='{ "act-lines__row--off": row.off }')
      .act-lines__cell(
        v-for='c in columns',
        :key='c.key',
        :class='{ "act-lines__num": c.align === "right", "act-lines__cell--wide": c.wide, "act-lines__cell--strong": c.strong }',
        :data-label='c.wide || !c.label ? undefined : c.label'
      )
        slot(:name='`cell-${c.key}`', :row='row') {{ row[c.key] }}

  .act-lines__foot(v-if='$slots.foot')
    slot(name='foot')
</template>

<script setup lang="ts" generic="T extends ActLinesRow">
import { computed } from 'vue';
import type { ActLinesColumn, ActLinesRow } from './act-lines.types';

const props = defineProps<{
  columns: ActLinesColumn[];
  /** Строки экрана — свой тип строки приходит в слоты ячеек как есть. */
  rows: T[];
}>();

defineSlots<{
  section?: (props: { row: T }) => unknown;
  foot?: () => unknown;
  [cell: `cell-${string}`]: ((props: { row: T }) => unknown) | undefined;
}>();

/**
 * Ширины колонок: заданная либо резиновая для широкой (позиция). У каждой
 * строки своя сетка, поэтому ширина «по содержимому» разъехалась бы между
 * строками — колонка без ширины получает общую по умолчанию.
 */
const DEFAULT_COLUMN_WIDTH = '112px';
const gridTemplate = computed(() =>
  props.columns.map((c) => (c.wide ? c.width ?? 'minmax(0, 1fr)' : c.width ?? DEFAULT_COLUMN_WIDTH)).join(' '),
);
</script>

<style scoped lang="scss">
.act-lines {
  display: flex;
  flex-direction: column;

  &__row {
    display: grid;
    grid-template-columns: var(--act-lines-cols);
    column-gap: var(--p-4, 16px);
    align-items: center;
    padding: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);

    // Полоса подписей колонок: мягкая заливка, скруглённая.
    &--head {
      padding-top: var(--p-2, 8px);
      padding-bottom: var(--p-2, 8px);
      border-top: 0;
      border-radius: var(--p-r-sm, 8px);
      background: var(--p-surface-2);
      font-size: var(--p-fs-eyebrow, 11px);
      font-weight: 600;
      letter-spacing: var(--p-ls-eyebrow, 0.08em);
      text-transform: uppercase;
      color: var(--p-ink-3);
    }

    &--head + & {
      border-top: 0;
    }

    &--off .act-lines__cell {
      opacity: 0.45;
    }

    // Галка в строке остаётся яркой: ею строку и возвращают.
    &--off .act-lines__cell:first-child {
      opacity: 1;
    }
  }

  &__section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding: var(--p-4, 16px) var(--p-3, 12px) var(--p-2, 8px);
    border-top: 1px solid var(--p-line);
    font-size: var(--p-fs-body-sm, 13px);
    font-weight: 600;
    color: var(--p-ink-2);
  }

  &__cell {
    min-width: 0;
    color: var(--p-ink-2);

    &--wide {
      color: var(--p-ink);
    }

    &--strong {
      font-weight: 600;
      color: var(--p-ink);
    }

    // Поле ввода в ячейке: без резерва строки подсказки, число по правому краю —
    // поле стоит на одной линии с текстом соседних ячеек.
    :deep(.q-field--with-bottom) {
      padding-bottom: 0;
    }

    :deep(.q-field__bottom) {
      display: none;
    }

    :deep(input) {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  }

  &__num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  &__foot {
    border-top: 1px solid var(--p-line);
    padding: var(--p-3, 12px);
  }
}

// Узкий экран: широкая колонка во всю строку, прочие — парами с подписью сверху.
@media (max-width: 768px) {
  .act-lines {
    &__row {
      grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
      row-gap: var(--p-2, 8px);

      &--head {
        display: none;
      }
    }

    &__cell--wide {
      grid-column: 1 / -1;
    }

    &__cell[data-label] {
      text-align: left;

      &::before {
        content: attr(data-label);
        display: block;
        margin-bottom: 2px;
        font-size: var(--p-fs-eyebrow, 11px);
        font-weight: 600;
        letter-spacing: var(--p-ls-eyebrow, 0.08em);
        text-transform: uppercase;
        color: var(--p-ink-3);
      }
    }
  }
}
</style>
