<template>
  <q-markup-table
    :flat="flat"
    :bordered="bordered"
    :dense="dense"
    :separator="separator"
    class="base-markup-table"
    :class="{
      'base-markup-table--sticky-head': stickyHeader,
      'base-markup-table--sticky-col': stickyFirstColumn,
    }"
    :style="tableStyle"
  >
    <slot />
  </q-markup-table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BaseMarkupTableProps } from './BaseMarkupTable.types';

/**
 * Таблица, разметку которой экран пишет сам, — но через Quasar, а не голым
 * тегом `<table>`.
 *
 * Нужна там, где данные не список строк: координатная сетка склада (столбцы —
 * секции, строки — ярусы, в каждой ячейке зона сброса со стопкой карточек),
 * печатные формы, сводные матрицы. `BaseTable` такие случаи не закрывает — он
 * строит `<tr>` на элемент массива и несёт сортировку с постраничностью,
 * которым в матрице нечего сортировать.
 *
 * Выбор между двумя: если у таблицы есть «строка данных» — `BaseTable`; если
 * таблица изображает двумерное пространство — `BaseMarkupTable`.
 */

const props = withDefaults(defineProps<BaseMarkupTableProps>(), {
  separator: 'horizontal',
  flat: true,
  bordered: false,
  dense: false,
  stickyHeader: false,
  stickyFirstColumn: false,
});

const tableStyle = computed(() => ({
  ...(props.minWidth ? { '--base-markup-table-min-width': props.minWidth } : {}),
  ...(props.maxHeight ? { '--base-markup-table-max-height': props.maxHeight } : {}),
}));
</script>

<style scoped lang="scss">
.base-markup-table {
  max-height: var(--base-markup-table-max-height, none);

  :deep(table) {
    min-width: var(--base-markup-table-min-width, 0);
  }

  // Заголовок остаётся на виду при вертикальной прокрутке длинного склада.
  &--sticky-head :deep(thead tr th) {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--p-surface-2);
  }

  // Заголовки строк (ярусы) остаются на виду при горизонтальной прокрутке —
  // иначе на широком складе непонятно, на каком ярусе смотришь ячейку.
  &--sticky-col :deep(tbody tr th:first-child),
  &--sticky-col :deep(thead tr th:first-child) {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--p-surface-2);
  }

  // Угловая ячейка стоит на пересечении обоих липких рядов — она должна
  // перекрывать и заголовок, и первую колонку.
  &--sticky-head.base-markup-table--sticky-col :deep(thead tr th:first-child) {
    z-index: 3;
  }
}
</style>
