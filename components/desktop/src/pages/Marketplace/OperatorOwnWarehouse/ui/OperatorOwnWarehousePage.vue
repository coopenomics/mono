<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { debounce } from 'quasar'
import { useRoute } from 'vue-router'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { Zeus } from '@coopenomics/sdk'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { BaseBadge, BaseButton, BaseInput, EmptyState, TableSkeleton } from 'src/shared/ui/base'
import type { BaseBadgeVariant } from 'src/shared/ui/base'
import type { TableSkeletonColumn } from 'src/shared/ui/base'
import { AccountBadge, PageHint } from 'src/shared/ui/domain'
import { PageTabs, type PageTab } from 'src/shared/ui/layout'
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates'
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units'
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace'
import { CoopStockSection } from 'src/widgets/Marketplace/CoopStockSection'
import {
  listInventory,
  assignInventoryShelf,
  generateInventoryLabel,
  type MarketplaceInventoryItemView,
} from '../api'

// Активный КУ оператора — из общего контекста стола (без ввода кода вручную).
const route = useRoute()
const store = useOperatorBranchStore()
const coopname = computed(() => String(route.params.coopname ?? ''))
const braname = computed(() => store.activeBraname ?? '')

const search = ref<string>('')
const items = ref<MarketplaceInventoryItemView[]>([])
const loading = ref(true)

// Склад/Остатки — два раздела в табах (канон — «Гарантийные возвраты»), не
// карточка, которая появляется/исчезает в зависимости от наличия остатков
// (жалоба 2026-08-02: мигало на каждый заход). Активный раздел всегда
// показывается — без фильтрации содержимого, только переключение видимости.
const activeTab = ref<'shelf' | 'stock'>('shelf')
const coopStockCount = ref(0)
const tabs = computed<PageTab[]>(() => [
  { key: 'shelf', label: 'Склад', count: sortedRows.value.length },
  { key: 'stock', label: 'Остатки', count: coopStockCount.value },
])
function onSelectTab(tab: PageTab): void {
  activeTab.value = tab.key as typeof activeTab.value
}

// Склад — это «что сейчас физически лежит на полке», не история движений.
// Выданное пайщику и списанное уже не на полке — им место в будущей истории
// заказов, не здесь. Поэтому фильтр не выбирается оператором, а зашит: только
// 3 состояния, которые вообще бывают «на складе».
const ON_SHELF_STATUSES = [
  Zeus.MarketplaceInventoryStatus.RECEIVED,
  Zeus.MarketplaceInventoryStatus.LABELED,
  Zeus.MarketplaceInventoryStatus.RETURNED,
]

// Имя заказчика для показа: ФИО (резолвится бэкендом), иначе — аккаунт.
function ordererName(row: MarketplaceInventoryItemView): string {
  return row.orderer_name?.trim() || row.orderer_account_snapshot
}

// «4» без единицы измерения непонятно, чего именно — штук, кг, упаковок.
// Тот же формат, что и в «Остатке кооператива» ниже на этой странице.
function quantityLabel(row: MarketplaceInventoryItemView): string {
  const saleUnit = marketplaceOrderSaleUnit(row.quantity_per_label, row.unit_of_measure, row.package_size)
  return `${saleUnit.units}×${saleUnit.unitLabel}`
}

// Омни-поиск: одно поле ищет по нескольким способам сразу — заказчик (ФИО и
// аккаунт), товар, полка, штрих-код. Оператор не выбирает режим заранее.
const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return items.value.filter((row) => {
    if (q) {
      const hay = [
        row.orderer_name,
        row.orderer_account_snapshot,
        row.product_name_snapshot,
        row.shelf,
        row.barcode_value,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

// Сортировка по дате приёмки; по умолчанию свежие сверху.
const sortDir = ref<'asc' | 'desc'>('desc')
const sortMark = computed(() => (sortDir.value === 'asc' ? '↑' : '↓'))
function toggleSort(): void {
  sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
}
const sortedRows = computed(() => {
  const list = [...filteredRows.value]
  list.sort((a, b) => {
    const diff = new Date(String(a.received_at)).getTime() - new Date(String(b.received_at)).getTime()
    return sortDir.value === 'asc' ? diff : -diff
  })
  return list
})

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Полка', class: 'col-shelf', cell: 'text' },
  { label: 'Товар', cell: 'text' },
  { label: 'Заказчик', class: 'col-orderer', cell: 'text' },
  { label: 'Кол-во', class: 'col-qty', cell: 'text', cellWidth: '120px' },
  { label: 'Штрих-код', class: 'col-barcode', cell: 'text' },
  { label: 'Состояние', class: 'col-status', cell: 'badge' },
  { label: 'Годен до', class: 'col-expiry', cell: 'text', cellWidth: '120px' },
  { label: 'Принято', class: 'col-date', cell: 'text', cellWidth: '120px' },
]

async function load(): Promise<void> {
  if (!braname.value.trim()) {
    items.value = []
    return
  }
  loading.value = true
  try {
    items.value = await listInventory({ braname: braname.value.trim(), statuses: ON_SHELF_STATUSES })
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить склад участка')
  } finally {
    loading.value = false
  }
}

// Точечно вмердживаем затронутые позиции после инлайн-действия. ФИО заказчика
// резолвится только на read-пути списка (в ответе мутации оно null) — сохраняем
// уже известное имя, чтобы оно не пропало из строки.
function applyUpdated(updated: MarketplaceInventoryItemView[]): void {
  const map = new Map(items.value.map((i) => [i.id, i]))
  for (const u of updated) {
    const prev = map.get(u.id)
    map.set(u.id, { ...u, orderer_name: u.orderer_name ?? prev?.orderer_name ?? null })
  }
  items.value = [...map.values()]
}

watch(braname, () => void load())

// Realtime вместо кнопки «Обновить»: склад пополняется закрывающей подписью
// председателя (акт → ACCEPTED_TO_COOP), пустеет подписью выдачи заказчиком
// (заказ → RECEIVED). Оба сигнала приходят в служебный канал персонала КУ.
const reloadLive = debounce(() => {
  if (loading.value) return
  void load()
}, 400)
useMarketplaceRealtime(
  {
    MarketplaceAplReceptionStatusChangedEvent: (event) => {
      if (event.braname === braname.value.trim()) reloadLive()
    },
    MarketplaceOrderStatusChangedEvent: () => reloadLive(),
    // Исполненное списание тоже опустошает полки склада.
    MarketplaceWriteoffStatusChangedEvent: () => reloadLive(),
  },
  { onResync: () => reloadLive() },
)

onMounted(async () => {
  await store.ensureLoaded(coopname.value)
  void load()
})

// ─── Инлайн-правка полки: поле всегда редактируемо, сохраняем по blur/Enter,
// только если значение изменилось. Без кнопок по бокам — просто кликаешь и правишь.
const shelfDraft = reactive<Record<string, string>>({})
const savingShelfId = ref<string | null>(null)

function shelfValue(row: MarketplaceInventoryItemView): string {
  return shelfDraft[row.id] ?? row.shelf ?? ''
}
function onShelfInput(row: MarketplaceInventoryItemView, value: string): void {
  shelfDraft[row.id] = value
}
async function commitShelf(row: MarketplaceInventoryItemView): Promise<void> {
  const draft = (shelfDraft[row.id] ?? row.shelf ?? '').trim()
  if (draft === (row.shelf ?? '').trim()) return
  savingShelfId.value = row.id
  try {
    const updated = await assignInventoryShelf({
      inventory_id: row.id,
      shelf: draft || null,
    })
    applyUpdated(updated)
    delete shelfDraft[row.id]
    SuccessAlert('Полка обновлена')
  } catch (e) {
    FailAlert(e, 'Не удалось сохранить полку')
  } finally {
    savingShelfId.value = null
  }
}

// ─── Инлайн-выпуск штрих-кода ───
const issuingBarcodeId = ref<string | null>(null)
async function issueBarcode(row: MarketplaceInventoryItemView): Promise<void> {
  issuingBarcodeId.value = row.id
  try {
    const updated = await generateInventoryLabel({ inventory_id: row.id })
    applyUpdated(updated)
    SuccessAlert('Штрих-код выпущен')
  } catch (e) {
    FailAlert(e, 'Не удалось выпустить штрих-код')
  } finally {
    issuingBarcodeId.value = null
  }
}

function humanStatus(status: string): string {
  switch (status) {
    case Zeus.MarketplaceInventoryStatus.RECEIVED:
      return 'Принято'
    case Zeus.MarketplaceInventoryStatus.LABELED:
      return 'Промаркировано'
    case Zeus.MarketplaceInventoryStatus.ISSUED:
      return 'Выдано пайщику'
    case Zeus.MarketplaceInventoryStatus.RETURNED:
      return 'Возврат на склад'
    case Zeus.MarketplaceInventoryStatus.WRITTEN_OFF:
      return 'Списано'
    default:
      return status
  }
}

function statusVariant(status: string): BaseBadgeVariant {
  switch (status) {
    case Zeus.MarketplaceInventoryStatus.RECEIVED:
      return 'neutral'
    case Zeus.MarketplaceInventoryStatus.LABELED:
      return 'info'
    case Zeus.MarketplaceInventoryStatus.ISSUED:
      return 'pos'
    case Zeus.MarketplaceInventoryStatus.RETURNED:
      return 'warn'
    case Zeus.MarketplaceInventoryStatus.WRITTEN_OFF:
      return 'neg'
    default:
      return 'neutral'
  }
}

// Время с бэкенда в UTC — показываем в локальном поясе оператора (env.TIMEZONE).
function formatDateTime(value: unknown): string {
  const out = formatDateToLocalTimezone(value, 'DD.MM.YYYY HH:mm')
  return out || '—'
}

// Срок годности — без времени (только дата). По нему идёт списание просрочки,
// поэтому истёкший срок подсвечиваем красным.
function formatDate(value: unknown): string {
  const out = formatDateToLocalTimezone(value, 'DD.MM.YYYY')
  return out || '—'
}

function isExpired(value: unknown): boolean {
  if (value === null || value === undefined) return false
  const t = new Date(String(value)).getTime()
  return Number.isFinite(t) && t < Date.now()
}
</script>

<template lang="pug">
q-page.warehouse(role='region', aria-label='Склад участка')
  OperatorBranchBar

  EmptyState(
    v-if='store.loaded && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Склад участка доступен председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    PageHint(storage-key='mp:operator-warehouse:banner-dismissed')
      | Имущество, принятое на ваш пункт выдачи: что лежит на складе, на какой
      | полке, заказчик и состояние. Полку можно поправить, а штрих-код выпустить
      | прямо в строке. Штрих-код есть не у всех позиций — он опционален.

    PageTabs(:tabs='tabs', :active-key='activeTab', @select='onSelectTab')

    template(v-if='activeTab === "shelf"')
      //- Поиск — отдельной строкой (не в одном ряду с чипами: их высоты разные и
      //- поле «скачет» относительно чипов). Ниже — чипы-фильтры состояния.
      BaseInput.warehouse__search(
        v-model='search',
        type='search',
        placeholder='Поиск: заказчик, товар, полка, штрих-код',
        clearable
      )

      TableSkeleton(
        v-if='loading && !items.length',
        :columns='skeletonColumns',
        :rows='6',
        min-width='900px'
      )

      .table-wrap(v-else-if='sortedRows.length')
        .table-scroll
          table.table
            thead
              tr
                th.col-shelf Полка
                th.col-product Товар
                th.col-orderer Заказчик
                th.col-qty Кол-во
                th.col-barcode Штрих-код
                th.col-status Состояние
                th.col-expiry Годен до
                th.col-sort.col-date(@click='toggleSort') Принято {{ sortMark }}
            tbody
              tr(v-for='row in sortedRows', :key='row.id')
                //- Полка — инлайн-правка: поле всегда редактируемо, сохраняется по
                //- уходу фокуса или Enter. Никаких кнопок по бокам.
                td.col-shelf
                  BaseInput.warehouse__shelf-input(
                    :model-value='shelfValue(row)',
                    placeholder='Полка',
                    flat,
                    :readonly='savingShelfId === row.id',
                    @update:model-value='(v) => onShelfInput(row, v)',
                    @blur='commitShelf(row)',
                    @keyup.enter='commitShelf(row)'
                  )

                td.col-product.warehouse__product {{ row.product_name_snapshot }}

                td.col-orderer
                  .warehouse__orderer
                    span.warehouse__orderer-name {{ ordererName(row) }}
                    AccountBadge(:account-name='row.orderer_account_snapshot', size='sm')

                td.col-qty {{ quantityLabel(row) }}

                //- Штрих-код — есть: моно-значение; нет: инлайн-выпуск.
                td.col-barcode
                  span.q-mono(v-if='row.barcode_value') {{ row.barcode_value }}
                  BaseButton.warehouse__issue(
                    v-else,
                    variant='ghost',
                    size='sm',
                    :loading='issuingBarcodeId === row.id',
                    @click='issueBarcode(row)'
                  )
                    template(#icon-left)
                      q-icon(name='label', size='16px')
                    | Выпустить

                td.col-status
                  BaseBadge(:variant='statusVariant(row.status)') {{ humanStatus(row.status) }}

                td.col-expiry(:class='{ "warehouse__expired": isExpired(row.expiry_date) }') {{ formatDate(row.expiry_date) }}

                td.col-date {{ formatDateTime(row.received_at) }}

        .table-foot
          span Позиций: {{ sortedRows.length }}

      EmptyState(
        v-else,
        title='На складе пусто',
        body='Здесь появятся принятые позиции участка. Проверьте поиск.'
      )
        template(#icon)
          q-icon(name='inventory_2', size='48px')

    //- Остаток кооператива (requirement 76): обезличенные позиции после
    //- недовыдач/отказов — публикация в каталог предложением от кооператива.
    CoopStockSection(v-else-if='activeTab === "stock"', @count='(n) => (coopStockCount = n)')
</template>

<style scoped lang="scss">
.warehouse {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__search {
    max-width: 420px;
    width: 100%;
  }

  &__shelf-input {
    width: 100%;
  }

  &__issue {
    white-space: nowrap;
  }

  &__orderer {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__orderer-name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  &__product {
    overflow-wrap: anywhere;
  }

  // Просроченный срок годности — красным: оператору видно, что пора списывать.
  &__expired {
    color: var(--p-neg);
    font-weight: 600;
  }
}

.table-scroll {
  overflow-x: auto;
}
// Сумма ширин колонок = min-width таблицы: при table-layout:fixed колонки
// не схлопываются (товар не «зажат»), а на узких экранах включается горизонтальный
// скролл вместо наезжающих друг на друга колонок.
.table {
  table-layout: fixed;
  min-width: 1380px;
}

.col-shelf {
  width: 200px;
}
.col-product {
  width: 240px;
}
.col-orderer {
  width: 200px;
}
.col-qty {
  width: 130px;
  text-align: right;
}
.col-barcode {
  width: 150px;
}
.col-status {
  width: 140px;
}
.col-expiry {
  width: 120px;
  white-space: nowrap;
}
.col-date {
  width: 160px;
  white-space: nowrap;
}
.col-sort {
  cursor: pointer;
  user-select: none;
}

@media (max-width: 768px) {
  .warehouse {
    padding: var(--p-4, 16px);

    &__search {
      max-width: none;
    }
  }
}
</style>
