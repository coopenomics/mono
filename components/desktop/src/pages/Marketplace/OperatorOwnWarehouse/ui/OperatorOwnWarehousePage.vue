<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { debounce } from 'quasar'
import { useRoute } from 'vue-router'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { Zeus } from '@coopenomics/sdk'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import {
  BaseBadge,
  BaseButton,
  BaseInput,
  BaseSelect,
  BaseTable,
  EmptyState,
} from 'src/shared/ui/base'
import type {
  BaseBadgeVariant,
  BaseSelectOption,
  BaseTableColumn,
} from 'src/shared/ui/base'
import { AccountBadge, PageHint } from 'src/shared/ui/domain'
import { PageTabs, type PageTab } from 'src/shared/ui/layout'
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates'
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units'
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace'
import { CoopStockSection } from 'src/widgets/Marketplace/CoopStockSection'
import {
  buildPlacementOptions,
  locationLabel,
  locationSearchTokens,
  parsePlacementValue,
  placementValueOf,
  useMarketplaceStorageStore,
} from 'src/entities/MarketplaceStorage'
import {
  assignInventoryPlacement,
  generateInventoryLabel,
  listInventory,
  type MarketplaceInventoryItemView,
} from 'src/entities/MarketplaceInventory'

// Активный КУ оператора — из общего контекста стола (без ввода кода вручную).
const route = useRoute()
const store = useOperatorBranchStore()
const storage = useMarketplaceStorageStore()
const coopname = computed(() => String(route.params.coopname ?? ''))
const braname = computed(() => store.activeBraname ?? '')

const containersEnabled = computed(() => store.warehouseSettings.containers_enabled)
const cellsEnabled = computed(() => store.warehouseSettings.cells_enabled)
const placementEnabled = computed(() => store.addressedStorageEnabled)

const search = ref<string>('')
const items = ref<MarketplaceInventoryItemView[]>([])
const loading = ref(true)

// Склад/Остатки — два раздела в табах (канон — «Гарантийные возвраты»), не
// карточка, которая появляется/исчезает в зависимости от наличия остатков
// (жалоба 2026-08-02: мигало на каждый заход). Активный раздел всегда
// показывается — без фильтрации содержимого, только переключение видимости.
const activeTab = ref<'warehouse' | 'stock'>('warehouse')
const coopStockCount = ref(0)
const tabs = computed<PageTab[]>(() => [
  { key: 'warehouse', label: 'Склад', count: filteredRows.value.length },
  { key: 'stock', label: 'Остатки', count: coopStockCount.value },
])
function onSelectTab(tab: PageTab): void {
  activeTab.value = tab.key as typeof activeTab.value
}

// Склад — это «что сейчас физически лежит на складе», не история движений.
// Выданное пайщику и списанное уже не на складе — им место в будущей истории
// заказов, не здесь. Поэтому фильтр не выбирается оператором, а зашит: только
// 3 состояния, которые вообще бывают «на складе».
const ON_WAREHOUSE_STATUSES = [
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
// аккаунт), товар, место (код бокса и координата ячейки), штрих-код. Оператор
// не выбирает режим заранее.
const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return items.value.filter((row) => {
    if (q) {
      const hay = [
        row.orderer_name,
        row.orderer_account_snapshot,
        row.product_name_snapshot,
        row.barcode_value,
        ...locationSearchTokens(row, storage.index),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

// Сортировку ведёт сама таблица: по умолчанию свежие приёмки сверху.
// Дату сравниваем как время, а не как строку — иначе «09.08» встало бы
// раньше «10.07».
const columns = computed<BaseTableColumn<MarketplaceInventoryItemView>[]>(() => [
  { key: 'place', label: 'Место', width: '240px', field: (row) => placeLabel(row) },
  { key: 'product', label: 'Товар', width: '240px', sortable: true, field: 'product_name_snapshot' },
  { key: 'orderer', label: 'Заказчик', width: '200px', sortable: true, field: (row) => ordererName(row) },
  { key: 'qty', label: 'Кол-во', width: '130px', numeric: true, nowrap: true },
  { key: 'barcode', label: 'Штрих-код', width: '150px' },
  { key: 'status', label: 'Состояние', width: '140px', sortable: true, field: 'status' },
  { key: 'expiry', label: 'Годен до', width: '120px', nowrap: true, sortable: true, field: (row) => timeOf(row.expiry_date) },
  { key: 'received', label: 'Принято', width: '160px', nowrap: true, sortable: true, field: (row) => timeOf(row.received_at) },
])

/** Дата в миллисекундах для сортировки; пусто — в конец списка. */
function timeOf(value: unknown): number {
  if (value === null || value === undefined) return 0
  const t = new Date(String(value)).getTime()
  return Number.isFinite(t) ? t : 0
}

async function load(): Promise<void> {
  if (!braname.value.trim()) {
    items.value = []
    return
  }
  loading.value = true
  try {
    const [list] = await Promise.all([
      listInventory({ braname: braname.value.trim(), statuses: ON_WAREHOUSE_STATUSES }),
      // Места нужны, чтобы показать адрес: позиция несёт лишь идентификаторы.
      placementEnabled.value
        ? storage.load(braname.value.trim(), {
            containers: containersEnabled.value,
            cells: cellsEnabled.value,
          })
        : Promise.resolve(),
    ])
    items.value = list
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

// ─── Инлайн-правка места: выбор из заведённых боксов и ячеек ───
// Свободного текста здесь больше нет: место — это запись в справочнике, а не
// строка, которую каждый оператор пишет по-своему. Пустые боксы предлагаются
// первыми, у занятых видно число позиций.
const savingPlaceId = ref<string | null>(null)

function itemsInContainer(containerId: string): number {
  return items.value.filter((i) => i.container_id === containerId).length
}

const placementOptions = computed<BaseSelectOption[]>(() =>
  buildPlacementOptions({
    containers: storage.activeContainers,
    cells: storage.activeCells,
    index: storage.index,
    countOf: itemsInContainer,
    containersEnabled: containersEnabled.value,
    cellsEnabled: cellsEnabled.value,
  }),
)

function placementValue(row: MarketplaceInventoryItemView): string | null {
  return placementValueOf(row)
}

function placeLabel(row: MarketplaceInventoryItemView): string {
  return locationLabel(row, storage.index)
}

async function commitPlacement(
  row: MarketplaceInventoryItemView,
  value: string | number | null,
): Promise<void> {
  const { container_id, cell_id } = parsePlacementValue(value)
  if ((row.container_id ?? null) === container_id && (row.cell_id ?? null) === cell_id) return

  savingPlaceId.value = row.id
  try {
    const updated = await assignInventoryPlacement({
      inventory_id: row.id,
      container_id,
      cell_id,
    })
    applyUpdated(updated)
    SuccessAlert('Место обновлено')
  } catch (e) {
    FailAlert(e, 'Не удалось сохранить место')
  } finally {
    savingPlaceId.value = null
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
      | Имущество, принятое на ваш пункт выдачи: что лежит на складе, в каком
      | месте, заказчик и состояние. Место можно переназначить, а штрих-код
      | выпустить прямо в строке. Штрих-код есть не у всех позиций — он опционален.

    PageTabs(:tabs='tabs', :active-key='activeTab', @select='onSelectTab')

    template(v-if='activeTab === "warehouse"')
      //- Поиск — отдельной строкой (не в одном ряду с чипами: их высоты разные и
      //- поле «скачет» относительно чипов).
      BaseInput.warehouse__search(
        v-model='search',
        type='search',
        placeholder='Поиск: заказчик, товар, бокс, адрес, штрих-код',
        clearable
      )

      BaseTable(
        v-if='loading || filteredRows.length',
        :columns='columns',
        :rows='filteredRows',
        row-key='id',
        hover,
        sticky-header,
        :loading='loading',
        min-width='1380px',
        sort-by='received',
        descending
      )
        //- Место — выбор из заведённых боксов и ячеек прямо в строке. Когда
        //- адресное хранение выключено, показываем прочерк: места просто нет.
        template(#cell-place='{ row }')
          BaseSelect.warehouse__place-input(
            v-if='placementEnabled',
            :model-value='placementValue(row)',
            :options='placementOptions',
            placeholder='Указать место',
            :disabled='savingPlaceId === row.id',
            @update:model-value='(v: string | number | null) => commitPlacement(row, v)'
          )
          span.warehouse__place-static(v-else) {{ placeLabel(row) }}

        template(#cell-orderer='{ row }')
          .warehouse__orderer
            span.warehouse__orderer-name {{ ordererName(row) }}
            AccountBadge(:account-name='row.orderer_account_snapshot', size='sm')

        template(#cell-qty='{ row }')
          | {{ quantityLabel(row) }}

        //- Штрих-код — есть: моно-значение; нет: инлайн-выпуск.
        template(#cell-barcode='{ row }')
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

        template(#cell-status='{ row }')
          BaseBadge(:variant='statusVariant(row.status)') {{ humanStatus(row.status) }}

        template(#cell-expiry='{ row }')
          span(:class='{ "warehouse__expired": isExpired(row.expiry_date) }') {{ formatDate(row.expiry_date) }}

        template(#cell-received='{ row }')
          | {{ formatDateTime(row.received_at) }}

        template(#footer)
          span Позиций: {{ filteredRows.length }}

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

    // Поиск не показывает hint/error — резерв места под них (Quasar
    // reserve-hint-space) даёт пустой промежуток перед таблицей.
    :deep(.q-field__bottom) {
      min-height: 0;
      padding-top: 0;
    }
  }

  &__place-input {
    width: 100%;

    // Селект в ячейке таблицы не показывает hint/error — резерв строки под них
    // растянул бы строку и заставил её «прыгать» относительно соседних.
    :deep(.q-field__bottom) {
      min-height: 0;
      padding-top: 0;
    }
  }

  &__place-static {
    color: var(--p-ink-2);
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

@media (max-width: 768px) {
  .warehouse {
    padding: var(--p-4, 16px);

    &__search {
      max-width: none;
    }
  }
}
</style>
