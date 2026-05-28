<template lang="pug">
//- Скелетон canon-таблицы: та же структура .table-wrap/.table, что и у
//- реальной таблицы, поэтому при подгрузке данных каркас не дёргается.
//- Заголовки показываем сразу, в ячейках — мерцающие плейсхолдеры (.skel).
.table-wrap.table-wrap--skel(aria-busy='true', aria-label='Загрузка данных')
  .table-scroll
    table.table(:style='minWidth ? { minWidth } : undefined')
      thead
        tr
          th(
            v-for='(col, ci) in columns',
            :key='ci',
            :class='col.class',
            :style='col.width ? { width: col.width } : undefined'
          ) {{ col.label }}
      tbody
        tr(v-for='r in rowCount', :key='r')
          td(v-for='(col, ci) in columns', :key='ci', :class='col.class')
            template(v-if='cellType(col) === "text"')
              span.skel.skel--text(:style='{ width: cellWidth(col, r, ci) }')
            template(v-else-if='cellType(col) === "badge"')
              span.skel.skel--badge
            template(v-else-if='cellType(col) === "icon"')
              span.skel.skel--icon
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TableSkeletonColumn, TableSkeletonProps } from './TableSkeleton.types';

const props = withDefaults(defineProps<TableSkeletonProps>(), {
  rows: 5,
  minWidth: undefined,
});

const rowCount = computed(() => props.rows ?? 5);

const cellType = (col: TableSkeletonColumn): 'text' | 'badge' | 'icon' | 'none' =>
  col.cell ?? 'text';

// Псевдослучайная, но детерминированная ширина бара — чтобы строки
// выглядели «живо», а не сеткой одинаковых линий, и при этом не мигали
// между рендерами.
const widthSteps = ['52%', '74%', '40%', '88%', '63%'];
const cellWidth = (col: TableSkeletonColumn, row: number, ci: number): string => {
  if (col.cellWidth) return col.cellWidth;
  return widthSteps[(row + ci) % widthSteps.length];
};
</script>

<style lang="scss" scoped>
.skel--badge {
  display: inline-block;
  width: 72px;
  height: 18px;
  border-radius: 999px;
  background: var(--p-surface-2);
  position: relative;
  overflow: hidden;
}
.skel--badge::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--p-surface-3) 50%,
    transparent 100%
  );
  animation: skel-shimmer 1.6s infinite;
}

.skel--icon {
  display: inline-block;
  width: 18px;
  height: 18px;
  border-radius: var(--p-r-xs, 6px);
  background: var(--p-surface-2);
}
</style>
