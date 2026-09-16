<script setup lang="ts">
/**
 * Склад кооператива: что лежит на пунктах выдачи, сколько принято, выдано и
 * списано. Одна строка — пара «позиция × пункт выдачи»: одна и та же позиция
 * на разных участках это разные полки.
 *
 * Поиск и фильтры (участок, категория, состояние) живут в шапке таблицы, а не
 * в отдельной коробке над ней. Строка открывает предложение, по которому
 * имущество попало на склад, — карточку отдаёт страница оверлеем.
 *
 * Постраничность — своя: список склада приходит с бэкенда целиком (это одна
 * выборка по кооперативу), поэтому рисуем первые строки, а остальные по
 * кнопке «Показать ещё» — иначе тысяча позиций рисуется в DOM разом.
 */
import { computed, ref, watch, type PropType } from 'vue'
import { BaseButton, BaseTable, EmptyState } from 'src/shared/ui/base'
import type { BaseTableColumn } from 'src/shared/ui/base'
import { FilterBar } from 'src/shared/ui/domain'
import type { FilterDefinition, FilterValues } from 'src/shared/ui/domain'
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates'
import type { WarehouseRow } from './WarehouseSummaryGrid.types'

/** Сколько строк показываем сразу; дальше — по кнопке. */
const PAGE_SIZE = 50

const props = defineProps({
  rows: { type: Array as PropType<WarehouseRow[]>, required: true },
  // Флаг первичной загрузки от родителя: пока грузим и строк ещё нет — канон
  // требует каркас-таблицу, а не мелькающую заглушку «На складе пусто».
  loading: { type: Boolean, default: false },
})

const emit = defineEmits<{
  (e: 'row-click', row: WarehouseRow): void
}>()

const search = ref('')
const filters = ref<FilterValues>({})
const visibleCount = ref(PAGE_SIZE)

/** Состояние позиции — что именно администратор ищет на складе. */
const STATE_OPTIONS = [
  { label: 'Есть остаток', value: 'in_stock' },
  { label: 'Остаток нулевой', value: 'empty' },
  { label: 'Просрочено', value: 'expired' },
  { label: 'Без штрих-кода', value: 'unlabeled' },
]

// Списки участков и категорий строим по тому, что реально лежит на складе:
// пустых пунктов в фильтре быть не должно.
const pvzOptions = computed(() => {
  const map = new Map<string, string>()
  for (const r of props.rows) map.set(r.pvzBraname, pvzTitle(r))
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
})

const categoryOptions = computed(() => {
  const map = new Map<number, string>()
  for (const r of props.rows) {
    if (r.categoryId == null) continue
    map.set(r.categoryId, r.categoryName ?? `Категория ${r.categoryId}`)
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
})

const filterDefs = computed<FilterDefinition[]>(() => {
  const defs: FilterDefinition[] = []
  if (pvzOptions.value.length > 1) {
    defs.push({ key: 'braname', label: 'Пункт выдачи', type: 'select', options: pvzOptions.value })
  }
  if (categoryOptions.value.length > 1) {
    defs.push({ key: 'category', label: 'Категория', type: 'select', options: categoryOptions.value })
  }
  defs.push({ key: 'state', label: 'Состояние', type: 'select', options: STATE_OPTIONS })
  return defs
})

/** Состояние позиции: пусто в фильтре — подходит любая. */
function matchesState(row: WarehouseRow, state: unknown): boolean {
  switch (state) {
    case 'in_stock':
      return row.balance > 0
    case 'empty':
      return row.balance <= 0
    case 'expired':
      return isExpired(row)
    case 'unlabeled':
      return row.unlabeled > 0
    default:
      return true
  }
}

/** Омни-поиск: одно поле ищет по товару, категории, участку и его адресу. */
function matchesSearch(row: WarehouseRow, query: string): boolean {
  if (!query) return true
  return [row.title, row.categoryName, row.pvzName, row.pvzAddress, row.pvzBraname]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query)
}

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  const { braname, category, state } = filters.value
  return props.rows.filter(
    (r) =>
      (!braname || r.pvzBraname === braname) &&
      (category == null || r.categoryId === Number(category)) &&
      matchesState(r, state) &&
      matchesSearch(r, q),
  )
})

/** Строки текущей страницы: остальное — по кнопке «Показать ещё». */
const pageRows = computed(() => filteredRows.value.slice(0, visibleCount.value))
const hasMore = computed(() => filteredRows.value.length > pageRows.value.length)

// Сменили поиск или фильтр — показываем снова с начала: иначе после сужения
// списка кнопка «Показать ещё» осталась бы нажатой «в никуда».
watch([search, filters], () => {
  visibleCount.value = PAGE_SIZE
})

function showMore(): void {
  visibleCount.value += PAGE_SIZE
}

const columns = computed<BaseTableColumn<WarehouseRow>[]>(() => [
  { key: 'product', label: 'Позиция', width: '260px', sortable: true, field: 'title' },
  { key: 'pvz', label: 'Пункт выдачи', width: '260px', sortable: true, field: (row) => pvzTitle(row) },
  { key: 'incoming', label: 'Принято', width: '104px', numeric: true, sortable: true, field: 'incoming' },
  { key: 'issued', label: 'Выдано', width: '104px', numeric: true, sortable: true, field: 'issued' },
  { key: 'writtenOff', label: 'Списано', width: '104px', numeric: true, sortable: true, field: 'writtenOff' },
  { key: 'balance', label: 'Остаток', width: '112px', numeric: true, sortable: true, field: 'balance' },
  { key: 'unit', label: 'Ед.', width: '72px' },
  { key: 'expiry', label: 'Годен до', width: '128px', nowrap: true, sortable: true, field: (row) => row.expiryAt ?? 0 },
])

function pvzTitle(row: WarehouseRow): string {
  return row.pvzName?.trim() || row.pvzBraname
}

function isExpired(row: WarehouseRow): boolean {
  return row.expiryAt !== null && row.balance > 0 && row.expiryAt < Date.now()
}

function expiryLabel(row: WarehouseRow): string {
  if (row.expiryAt === null) return '—'
  return formatDateToLocalTimezone(new Date(row.expiryAt).toISOString(), 'DD.MM.YYYY') || '—'
}

function onRowClick(row: WarehouseRow): void {
  emit('row-click', row)
}
</script>

<template lang="pug">
.warehouse-grid
  FilterBar.warehouse-grid__filter(
    v-model:search='search',
    v-model='filters',
    search-placeholder='Поиск: товар, категория, пункт выдачи, адрес',
    :filters='filterDefs'
  )

  BaseTable(
    v-if='loading || filteredRows.length',
    :columns='columns',
    :rows='pageRows',
    row-key='key',
    hover,
    sticky-header,
    :loading='loading',
    min-width='1080px',
    sort-by='product',
    clickable-rows,
    @row-click='onRowClick'
  )
    template(#cell-product='{ row }')
      .warehouse-grid__product(:class='{ "warehouse-grid__product--linked": row.offerId }')
        span.warehouse-grid__product-name {{ row.title }}
        span.warehouse-grid__product-cat(v-if='row.categoryName') {{ row.categoryName }}

    template(#cell-pvz='{ row }')
      .warehouse-grid__pvz
        span.warehouse-grid__pvz-name {{ pvzTitle(row) }}
        span.warehouse-grid__pvz-addr(v-if='row.pvzAddress') {{ row.pvzAddress }}

    template(#cell-balance='{ row }')
      strong(:class='row.balance > 0 ? "" : "text-grey-6"') {{ row.balance }}

    template(#cell-expiry='{ row }')
      span(:class='isExpired(row) ? "warehouse-grid__expiry--over" : ""') {{ expiryLabel(row) }}

    template(#footer)
      .warehouse-grid__foot
        span Показано {{ pageRows.length }} из {{ filteredRows.length }}
        BaseButton(v-if='hasMore', variant='ghost', size='sm', @click='showMore') Показать ещё

  EmptyState(
    v-else,
    title='На складе пусто',
    body='Здесь появятся принятые на пункты выдачи позиции. Измените поиск или фильтры, если ожидали увидеть товар.'
  )
    template(#icon)
      q-icon(name='inventory_2', size='48px')
</template>

<style scoped lang="scss">
.warehouse-grid {
  width: 100%;
}

.warehouse-grid__filter {
  margin-bottom: var(--p-3, 12px);
}

.warehouse-grid__product {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-wrap: anywhere;
}

// Строка целиком открывает предложение (как в реестрах заказов и
// предложений); цветом подсвечено наименование — оно отвечает на вопрос, что
// именно откроется. Позиция без известного предложения остаётся обычной.
.warehouse-grid__product--linked .warehouse-grid__product-name {
  color: var(--p-primary);
}

.warehouse-grid__product-cat {
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm, 13px);
}

.warehouse-grid__pvz {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.warehouse-grid__pvz-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.warehouse-grid__pvz-addr {
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm, 13px);
  overflow-wrap: anywhere;
}

.warehouse-grid__expiry--over {
  color: var(--p-neg);
  font-weight: 600;
}

.warehouse-grid__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  width: 100%;
  color: var(--p-ink-2);
  font-size: var(--p-fs-meta, 12px);
}
</style>
