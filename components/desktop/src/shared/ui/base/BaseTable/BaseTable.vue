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
      'base-table--sticky': stickyHeader,
      'base-table--skeleton': skeleton,
      'base-table--selectable': selectionMode !== 'none',
    }"
    :table-row-class-fn="rowClassFn"
    :sort-method="serverSort ? keepServerOrder : undefined"
    :style="tableStyle"
    @row-click="onRowClick"
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
import { useFirstLoad } from 'src/shared/lib/composables';

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
  'row-click': [row: T];
  /** Только при `serverSort`: пользователь сменил сортировку по заголовку. */
  sort: [sort: { sortBy: string; descending: boolean }];
}>();

/** При серверной сортировке строки уже пришли в нужном порядке. */
const keepServerOrder = (rows: readonly T[]): readonly T[] => rows;

/**
 * Нажатие по строке. Каркас не кликается (там пустышки), и без признака
 * `clickableRows` событие не уходит: половина реестров строкой ничего не
 * открывает, и случайный переход там был бы сюрпризом.
 */
/** Элементы строки, у которых своё действие: нажатие по ним сущность не открывает. */
const OWN_ACTION_SELECTOR =
  '.q-checkbox, .q-btn, .q-menu, .q-toggle, .q-field, a, input, .q-table--col-auto-width';

/**
 * Открывается ли эта строка. Признак бывает общим на таблицу (реестр, где
 * каждая строка ведёт на свою сущность) и построчным (лента, где переход есть
 * только у части записей).
 */
function isRowClickable(row: T): boolean {
  if (skeleton.value) return false;
  const rule = props.clickableRows;
  return typeof rule === 'function' ? rule(row) : rule === true;
}

/** Курсор-указатель достаётся только тем строкам, которые действительно открываются. */
function rowClassFn(row: T): string {
  return isRowClickable(row) ? 'base-table__row--click' : '';
}

function onRowClick(evt: Event, row: T): void {
  if (!isRowClickable(row)) return;
  // Галочка выбора, кнопка действий и всплывающее меню внутри строки — сами по
  // себе действия. Открывать по ним ещё и сущность значит делать два дела на
  // одно нажатие: отметил бокс к печати — и получил панель поверх списка.
  const target = evt.target as Element | null;
  if (target?.closest?.(OWN_ACTION_SELECTOR)) return;
  emit('row-click', row);
}

/**
 * Ключ строки в том виде, в каком его ждёт q-table: имя поля строкой либо
 * функция. `keyof T` шире (символы и числа тоже ключи), поэтому имя приводим
 * к строке явно — иначе типы обёртки и Quasar не сходятся.
 */
type QTableRowKey = NonNullable<QTableProps['rowKey']>;

const rowKeyName = computed<QTableRowKey>(() => {
  // На каркасе ключ берём по имени поля-пустышки: функция ключа экрана ждёт
  // настоящую строку и на пустышке падает.
  if (skeleton.value) return skeletonKeyName.value;
  const key = props.rowKey;
  if (typeof key === 'function') return key as QTableRowKey;
  return key === undefined ? 'id' : String(key);
});

/** Имя поля-ключа для строк-пустышек каркаса: функции там подставлять нечего. */
const skeletonKeyName = computed(() =>
  typeof props.rowKey === 'string' ? props.rowKey : 'id',
);

const selectedRows = computed<T[]>({
  get: () => props.selected ?? [],
  set: (rows) => emit('update:selected', rows),
});

/**
 * Каркас — только на первой загрузке, пока показывать нечего. Повторные
 * загрузки (дочитка, поллинг) идут молча: на пустой таблице «loading и пусто»
 * снова истинно, и без признака завершённой первой загрузки строки каждый раз
 * сносило в каркас — таблица мерцала.
 */
const firstLoad = useFirstLoad(() => props.loading);
const skeleton = computed(() => firstLoad.value && props.rows.length === 0);

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
      [skeletonKeyName.value]: `__skel-${i}`,
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

// Смена сортировки по заголовку при серверной сортировке уходит экрану.
watch(
  () => [pagination.value.sortBy, pagination.value.descending] as const,
  ([sortBy, descending], [prevSortBy, prevDescending]) => {
    if (!props.serverSort) return;
    if (sortBy === prevSortBy && descending === prevDescending) return;
    emit('sort', { sortBy: sortBy ?? '', descending: Boolean(descending) });
  },
);

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
      // На каркасе значения не считаем: строки там — пустышки без доменных
      // полей, а функция колонки лезет в них как в настоящие данные и роняет
      // экран целиком (белый экран «Пунктов выдачи», 14.09.2026).
      field: skeleton.value
        ? () => ''
        : typeof col.field === 'function'
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

  // Строка открывает сущность — курсор показывает это до нажатия. Подсветка
  // строки под курсором одна на все таблицы платформы и живёт в каноне
  // (`quasar-canon.css`): иначе одни реестры выделяются зелёным, другие серым,
  // и разница читается как разница в поведении, которой нет.
  :deep(tbody tr.base-table__row--click) {
    cursor: pointer;
  }

  // Колонка галочек. При `table-layout: fixed` колонка без явной ширины
  // забрала бы весь остаток и отжала данные вправо, поэтому ширину задаём
  // здесь. Ширина считается по галочке: сам переключатель Quasar занимает
  // 40px вместе с областью нажатия, плюс отступ от края таблицы. С прежними
  // 44px при штатном отступе ячейки в 16px галочка не помещалась и обрезалась
  // справа (жалоба 2026-09-09).
  &--selectable :deep(.q-table--col-auto-width) {
    width: 56px;
    padding-left: var(--p-3, 12px);
    padding-right: 0;
  }

  // Галочка занимает свою ячейку целиком, без собственных отступов — иначе
  // сдвигается относительно колонки и снова упирается в край.
  &--selectable :deep(.q-table--col-auto-width .q-checkbox) {
    margin: 0;
  }

  &__skel {
    width: 100%;
  }
}
</style>
