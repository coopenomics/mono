<template>
  <q-table
    v-model:pagination="pagination"
    v-model:selected="selectedRows"
    flat
    wrap-cells
    :rows="displayRows"
    :columns="quasarColumns"
    :row-key="rowKeyName"
    :selection="selectionMode"
    :hide-bottom="!$slots.footer"
    :hide-pagination="true"
    binary-state-sort
    class="base-table"
    :class="{
      'base-table--hover': hover && !skeleton,
      'base-table--sticky': stickyHeader,
      'base-table--skeleton': skeleton,
      'base-table--selectable': selectionMode !== 'none',
    }"
    :style="tableStyle"
  >
    <template
      v-for="col in columns"
      :key="col.key"
      #[`body-cell-${col.key}`]="cellProps"
    >
      <q-td
        :props="cellProps"
        :class="{ 'col-num': col.numeric, 'col-nowrap': col.nowrap }"
      >
        <!-- Каркас рисуется внутри той же ячейки: колонка уже нужной ширины,
             поэтому при подстановке данных строка не меняет геометрию. -->
        <span v-if="skeleton" class="skel skel--text base-table__skel" />
        <slot
          v-else
          :name="`cell-${col.key}`"
          :row="cellProps.row"
          :value="cellProps.value"
        >
          {{ cellProps.value }}
        </slot>
      </q-td>
    </template>

    <template v-if="$slots.footer" #bottom>
      <slot name="footer" />
    </template>
  </q-table>
</template>

<script setup lang="ts" generic="T extends object">
import { computed, ref, watch } from 'vue';
import type { QTableProps } from 'quasar';
import type { BaseTableProps } from './BaseTable.types';

/**
 * Канон-таблица платформы: единственный способ показать реестр в
 * `pages`/`widgets`/`features`. Под капотом — `q-table`, поэтому доступны
 * сортировка, липкий заголовок и остальная машинерия Quasar; наружу отдаётся
 * узкий типизированный контракт `BaseTableColumn`, чтобы экраны не лепили
 * `q-table` напрямую и не расходились в оформлении.
 *
 * Состояние загрузки живёт ЗДЕСЬ, а не отдельным компонентом рядом: только так
 * каркас гарантированно повторяет ширины колонок реальной таблицы.
 *
 * Ограничение дженерика — `object`, а не `Record<string, unknown>`: доменные
 * вью-типы приходят из сгенерированного SDK и не обязаны нести индексную
 * сигнатуру, иначе каждый реестр пришлось бы приводить типом на месте.
 */

const props = withDefaults(defineProps<BaseTableProps<T>>(), {
  skeletonRows: 6,
  selection: 'none',
});

const emit = defineEmits<{
  'update:selected': [rows: T[]];
}>();

const rowKeyName = computed(() => (props.rowKey as string | undefined) ?? 'id');

const selectedRows = computed<T[]>({
  get: () => props.selected ?? [],
  set: (rows) => emit('update:selected', rows),
});

/** Каркас показываем, только пока показывать нечего: обновление идёт молча. */
const skeleton = computed(() => Boolean(props.loading) && props.rows.length === 0);

/** На каркасе выбирать нечего — галочки на пустышках только сбивают с толку. */
const selectionMode = computed(() => (skeleton.value ? 'none' : props.selection));

/**
 * Строки-пустышки под каркас. Реальному типу `T` они не соответствуют — это
 * временная подложка исключительно для отрисовки, поэтому приведение локальное
 * и наружу не протекает.
 */
const skeletonPlaceholders = computed(
  () =>
    Array.from({ length: props.skeletonRows }, (_, i) => ({
      [rowKeyName.value]: `__skel-${i}`,
    })) as unknown as T[],
);

const displayRows = computed<T[]>(() =>
  skeleton.value ? skeletonPlaceholders.value : props.rows,
);

const pagination = ref({
  sortBy: props.sortBy ?? '',
  descending: props.descending ?? false,
  page: 1,
  // 0 = показывать все строки: постраничность реестров решается на бэкенде, а
  // не нарезкой уже полученного списка.
  rowsPerPage: 0,
});

watch(
  () => [props.sortBy, props.descending],
  ([sortBy, descending]) => {
    pagination.value = {
      ...pagination.value,
      sortBy: (sortBy as string) ?? '',
      descending: Boolean(descending),
    };
  },
);

const quasarColumns = computed<QTableProps['columns']>(() =>
  props.columns.map((col) => {
    const width = col.width ? `width: ${col.width};` : '';
    return {
      name: col.key,
      label: col.label,
      align: col.align ?? (col.numeric ? 'right' : 'left'),
      field:
        typeof col.field === 'function'
          ? (col.field as (row: unknown) => unknown)
          : ((col.field as string) ?? col.key),
      // Каркас не сортируется: сортировать пустышки бессмысленно.
      sortable: Boolean(col.sortable) && !skeleton.value,
      ...(col.sort
        ? {
            sort: col.sort as (
              a: unknown,
              b: unknown,
              rowA: unknown,
              rowB: unknown,
            ) => number,
          }
        : {}),
      ...(width ? { style: width, headerStyle: width } : {}),
    };
  }),
);

const tableStyle = computed(() => ({
  ...(props.minWidth ? { '--base-table-min-width': props.minWidth } : {}),
  ...(props.maxHeight ? { '--base-table-max-height': props.maxHeight } : {}),
}));
</script>

<style scoped lang="scss">
.base-table {
  // Фиксированная раскладка: колонки держат заданную ширину, а не пляшут от
  // содержимого. Ниже min-width включается горизонтальная прокрутка внутри
  // собственного контейнера q-table — страница вбок не едет.
  :deep(.q-table) {
    table-layout: fixed;
    min-width: var(--base-table-min-width, 0);
  }

  :deep(.q-table__middle) {
    max-height: var(--base-table-max-height, none);
  }

  // Числа и суммы не переносим: разорванная посередине сумма читается как две.
  :deep(.col-num) {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  :deep(.col-nowrap) {
    white-space: nowrap;
  }

  // Длинные наименования и адреса переносим, а не растягиваем колонку.
  // Сам перенос включает `wrap-cells` у q-table: без него Quasar ставит
  // `white-space: nowrap`, и длинный текст вылезает поверх соседних колонок.
  :deep(td) {
    overflow-wrap: anywhere;
  }

  &--hover :deep(tbody tr:hover) {
    background: var(--p-surface-2);
  }

  &--sticky :deep(thead tr th) {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--p-surface);
  }

  // Каркас: строки не кликаются и не подсвечиваются.
  &--skeleton :deep(tbody tr) {
    pointer-events: none;
  }

  // Колонка галочек. При `table-layout: fixed` колонка без явной ширины
  // забрала бы весь остаток и отжала данные вправо, поэтому ширину задаём
  // здесь — ровно под галочку.
  &--selectable :deep(.q-table--col-auto-width) {
    width: 44px;
    padding-right: 0;
  }

  &__skel {
    width: 100%;
  }
}
</style>
