<script setup lang="ts">
import type { GoodsManifestLine, GoodsManifestProps } from './GoodsManifest.types';

/**
 * Накладная состава — карточка «что и сколько» по упаковкам: шапка, строки с
 * названием и количеством, при необходимости стоимость и примечание.
 *
 * Одна на все ленты оператора: «Ожидаемые поставки» (в поставке / привезёт)
 * и «Выдача» (к выдаче / в процессе). Раньше каждая страница держала свою
 * копию разметки и стилей, и они расходились: на выдаче «15 л» без тары
 * против «10 упак. 1 л» на поставках (просьба владельца 2026-09-09).
 *
 * Слот `line-extra` — под названием строки: стадия выдачи, кнопки по строке.
 */
defineProps<GoodsManifestProps>();
defineSlots<{
  'line-extra'?: (props: { line: GoodsManifestLine }) => unknown;
}>();
</script>

<template lang="pug">
.goods-manifest
  .goods-manifest__head
    span {{ title }}
    span.goods-manifest__count(v-if='count') {{ count }}
  ul.goods-manifest__items
    li.goods-manifest__item(v-for='line in lines', :key='line.key')
      .goods-manifest__main
        span.goods-manifest__prod {{ line.name }}
        slot(name='line-extra', :line='line')
        span.goods-manifest__note(v-if='line.note') {{ line.note }}
      .goods-manifest__side
        span.goods-manifest__qty
          | {{ line.quantity }}
          span.goods-manifest__qty-note(v-if='line.quantityNote')  · {{ line.quantityNote }}
        span.goods-manifest__cost(v-if='line.cost') {{ line.cost }}
</template>

<style scoped lang="scss">
// Накладной в рамке, а не серой плашкой: строки идут по упаковкам, и
// волосяные линии между ними читаются лучше сплошной заливки.
.goods-manifest {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm, 8px);
  overflow: hidden;

  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--p-2, 8px);
    padding: var(--p-2, 8px) var(--p-3, 12px);
    background: var(--p-surface-2);
    border-bottom: 1px solid var(--p-line);
    font-size: var(--p-fs-meta, 12px);
    letter-spacing: var(--p-ls-eyebrow, 0.08em);
    text-transform: uppercase;
    color: var(--p-ink-3);
  }

  &__count {
    letter-spacing: 0;
    text-transform: none;
    font-variant-numeric: tabular-nums;
  }

  &__items {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    padding: var(--p-2, 8px) var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
    font-size: var(--p-fs-body-sm, 13px);

    &:first-child {
      border-top: none;
    }
  }

  &__main {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__prod {
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__note {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-warn);
  }

  // Количество и стоимость — столбиком у правого края: тара и число читаются
  // одним взглядом, сумма под ними мельче.
  &__side {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    text-align: right;
  }

  &__qty {
    color: var(--p-ink);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  &__qty-note {
    color: var(--p-ink-3);
    font-weight: 400;
  }

  &__cost {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
}
</style>
