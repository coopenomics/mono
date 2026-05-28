<template>
  <q-table
    flat
    :rows="rows"
    :columns="quasarColumns"
    :row-key="(rowKey as string) || 'id'"
    :hide-bottom="!$slots.footer"
    :hide-pagination="true"
    :pagination="{ rowsPerPage: 0 }"
    binary-state-sort
    class="base-table"
  >
    <template
      v-for="col in columns"
      :key="col.key"
      #[`body-cell-${col.key}`]="cellProps"
    >
      <q-td :props="cellProps" :class="{ 'col-num': col.numeric }">
        <slot :name="`cell-${col.key}`" :row="cellProps.row" :value="cellProps.value">
          {{ cellProps.value }}
        </slot>
      </q-td>
    </template>
    <template v-if="$slots.footer" #bottom>
      <slot name="footer" />
    </template>
  </q-table>
</template>

<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed } from 'vue';
import type { QTableProps } from 'quasar';
import type { BaseTableProps } from './BaseTable.types';

const props = defineProps<BaseTableProps<T>>();

const quasarColumns = computed<QTableProps['columns']>(() =>
  props.columns.map((col) => ({
    name: col.key,
    label: col.label,
    align: col.align ?? (col.numeric ? 'right' : 'left'),
    field:
      typeof col.field === 'function'
        ? (col.field as (row: unknown) => unknown)
        : ((col.field as string) ?? col.key),
  })),
);
</script>

<style scoped>
.base-table :deep(.col-num) {
  font-variant-numeric: tabular-nums;
}
</style>
