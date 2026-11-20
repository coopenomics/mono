<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useLiveReload } from 'src/shared/lib/realtime';
import { useFirstLoad } from 'src/shared/lib/composables'
import { debounce } from 'quasar'
import { useRoute } from 'vue-router'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { BaseButton, BaseInput, BaseSelect, EmptyState } from 'src/shared/ui/base'
import type { BaseSelectOption } from 'src/shared/ui/base'
import { PageHint } from 'src/shared/ui/domain'
import { WarehouseInventoryTable } from 'src/widgets/Marketplace/WarehouseInventoryTable'
import { InventoryItemDrawer } from 'src/widgets/Marketplace/InventoryItemDrawer'
import { marketLiveTables } from 'src/shared/lib/marketplace';
import { useQueryOverlay } from 'src/shared/lib/navigation'
import { OfferRegistryOverlay } from 'src/widgets/Marketplace/OfferRegistryOverlay'
import { CoopStockSection } from 'src/widgets/Marketplace/CoopStockSection'
import { ScannerDialog } from 'src/widgets/Marketplace/ScannerDialog'
import { LabelSheetPrintDialog } from 'src/widgets/Marketplace/LabelSheetPrintDialog'
import {
  buildPlacementOptions,
  locationLabel,
  locationSearchTokens,
  parsePlacementValue,
  placementValueOf,
  useMarketplaceStorageStore,
} from 'src/entities/MarketplaceStorage'
import {
  MARKETPLACE_ON_WAREHOUSE_STATUSES,
  assignInventoryPlacement,
  inventoryOrdererName,
  listInventory,
  type MarketplaceInventoryItemView,
} from 'src/entities/MarketplaceInventory'
import { t as i18nT } from 'src/shared/i18n';

const props = defineProps<{
  /** Какой раздел показывать: имущество на складе или обезличенный остаток. */
  section: 'warehouse' | 'stock'
}>()

const emit = defineEmits<{
  (e: 'counts', value: { warehouse: number; stock: number }): void
}>()

// Активный КУ оператора — из общего контекста стола (без ввода кода вручную).
const route = useRoute()
const store = useOperatorBranchStore()
const storage = useMarketplaceStorageStore()
const coopname = computed(() => String(route.params.coopname ?? ''))
/** Предложение открывается оверлеем поверх склада — адрес держит `?offer=`. */
const offerOverlay = useQueryOverlay('offer')
/** Карточка имущества на складе — адрес держит `?item=`. */
const itemOverlay = useQueryOverlay('item')

function openItem(row: MarketplaceInventoryItemView): void {
  itemOverlay.open(row.id)
}
const braname = computed(() => store.activeBraname ?? '')

const containersEnabled = computed(() => store.warehouseSettings.containers_enabled)
const cellsEnabled = computed(() => store.warehouseSettings.cells_enabled)
const placementEnabled = computed(() => store.addressedStorageEnabled)

const search = ref<string>('')
const items = ref<MarketplaceInventoryItemView[]>([])
const loading = ref(true)
/** Каркас и пустое состояние — по первой загрузке; дочитка обновляет молча. */
const firstLoad = useFirstLoad(loading)

// Склад/Остатки — два раздела в табах (канон — «Гарантийные возвраты»), не
// карточка, которая появляется/исчезает в зависимости от наличия остатков
// (жалоба 2026-08-02: мигало на каждый заход). Активный раздел всегда
// показывается — без фильтрации содержимого, только переключение видимости.
const activeTab = computed(() => props.section)
const coopStockCount = ref(0)


// Склад — это «что сейчас физически лежит на складе», не история движений.
// Выданное пайщику и списанное уже не на складе — им место в будущей истории
// заказов, не здесь. Поэтому фильтр не выбирается оператором, а зашит общим
// списком состояний склада (по нему же считается занятость боксов).
const ON_WAREHOUSE_STATUSES = [...MARKETPLACE_ON_WAREHOUSE_STATUSES]

// Омни-поиск: одно поле ищет по нескольким способам сразу — заказчик (ФИО и
// аккаунт), товар, место (код бокса и координата ячейки), штрих-код. Оператор
// не выбирает режим заранее.
const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return items.value.filter((row) => {
    if (q) {
      const hay = [
        inventoryOrdererName(row),
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
// Счётчики разделов считает эта секция (только у неё есть строки склада и
// остатка), а показывает их полоса разделов на странице-обёртке. Watch стоит
// ПОСЛЕ `filteredRows`: с `immediate` он читает их сразу при инициализации.
watch(
  [() => filteredRows.value.length, coopStockCount],
  ([warehouse, stock]) => emit('counts', { warehouse, stock }),
  { immediate: true },
)

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
    FailAlert(e, i18nT('marketplace.operatorOwnWarehouse.loadError'))
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
useLiveReload(marketLiveTables('reception', 'order', 'writeoff'), () => reloadLive());

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
    SuccessAlert(i18nT('marketplace.operatorOwnWarehouse.placeUpdatedMessage'))
  } catch (e) {
    FailAlert(e, i18nT('marketplace.operatorOwnWarehouse.placeUpdateError'))
  } finally {
    savingPlaceId.value = null
  }
}

// ─── Сканирование этикетки и печать листа ───
// Этикетку печатают заранее листом, клеят на имущество и привязывают сканером в
// карточке. Скан этикетки на складе открывает карточку этой позиции (решение
// владельца 19.11.2026). Позиции участка уже загружены — код ищется среди них.
const scanOpen = ref(false)
const printOpen = ref(false)

function onLabelScanned(raw: string): void {
  const code = raw.trim()
  if (!code) return
  const found = items.value.find((row) => row.barcode_value === code)
  if (!found) {
    FailAlert(new Error(i18nT('marketplace.operatorOwnWarehouse.labelNotFound', { code })))
    return
  }
  scanOpen.value = false
  openItem(found)
}

</script>

<template lang="pug">
//- Секция стола «Склад моего КУ»: шапка участка и полоса разделов — на
//- странице-обёртке. Какой из двух разделов показывать, говорит проп.
.warehouse(role='region', :aria-label='$t("marketplace.operatorOwnWarehouse.ariaLabel")')
  EmptyState(
    v-if='store.loaded && !store.isOperator',
    :title='$t("marketplace.operatorOwnWarehouse.notOperatorTitle")',
    :body='$t("marketplace.operatorOwnWarehouse.notOperatorBody")'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    //- Своя подсказка на каждый раздел: склад и обезличенный остаток — про
    //- разное имущество, и общий текст врал бы половине экранов.
    PageHint(
      v-if='activeTab === "warehouse"',
      storage-key='mp:operator-warehouse:banner-dismissed'
    )
      | {{ $t('marketplace.operatorOwnWarehouse.hintLine1') }}
      | {{ $t('marketplace.operatorOwnWarehouse.hintLine2') }}
      | {{ $t('marketplace.operatorOwnWarehouse.hintLine3') }}

    PageHint(v-else, storage-key='mp:operator-coop-stock:banner-dismissed')
      | {{ $t('marketplace.operatorOwnWarehouse.unassignedHintLine1') }}
      | {{ $t('marketplace.operatorOwnWarehouse.unassignedHintLine2') }}
      | {{ $t('marketplace.operatorOwnWarehouse.unassignedHintLine3') }}

    template(v-if='activeTab === "warehouse"')
      //- Действия раздела — в шапке стола: найти позицию по этикетке и
      //- напечатать лист этикеток для наклейки.
      Teleport(to='#header-actions-host', defer)
        .warehouse__head-actions
          BaseButton(variant='secondary', size='sm', @click='scanOpen = true')
            template(#icon-left)
              q-icon(name='qr_code_scanner', size='16px')
            | {{ $t('marketplace.operatorOwnWarehouse.scanButton') }}
          BaseButton(variant='secondary', size='sm', @click='printOpen = true')
            template(#icon-left)
              q-icon(name='print', size='16px')
            | {{ $t('marketplace.operatorInventoryLabeling.printLabelsButton') }}

      //- Поиск — отдельной строкой (не в одном ряду с чипами: их высоты разные и
      //- поле «скачет» относительно чипов).
      BaseInput.warehouse__search.field-flush(
        v-model='search',
        type='search',
        :placeholder='$t("marketplace.operatorOwnWarehouse.searchPlaceholder")',
        clearable
      )

      //- Таблица склада — общая со складом стола администратора. Место
      //- правится прямо в строке; строка открывает карточку имущества.
      WarehouseInventoryTable(
        v-if='firstLoad || filteredRows.length',
        :rows='filteredRows',
        :loading='loading',
        :place-label='placeLabel',
        @row-click='openItem'
      )
        template(#cell-place='{ row }')
          BaseSelect.warehouse__place-input.field-flush(
            v-if='placementEnabled',
            :model-value='placementValue(row)',
            :options='placementOptions',
            :placeholder='$t("marketplace.operatorOwnWarehouse.placeInputPlaceholder")',
            searchable,
            :disabled='savingPlaceId === row.id',
            @click.stop,
            @update:model-value='(v) => commitPlacement(row, v)'
          )
          span.warehouse__place-static(v-else) {{ placeLabel(row) }}

      EmptyState(
        v-else,
        :title='$t("marketplace.operatorOwnWarehouse.emptyTitle")',
        :body='$t("marketplace.operatorOwnWarehouse.emptyBody")'
      )
        template(#icon)
          q-icon(name='inventory_2', size='48px')

    //- Остаток кооператива (requirement 76): обезличенные позиции после
    //- недовыдач/отказов — публикация в каталог предложением от кооператива.
    CoopStockSection(v-else-if='activeTab === "stock"', @count='(n) => (coopStockCount = n)')

  //- Карточка имущества на складе; наклеенная этикетка привязывается в ней.
  InventoryItemDrawer(
    :items='items',
    :place-label='placeLabel',
    order-route-name='marketplace-pvz-order-detail',
    labelable,
    @open-offer='(id) => offerOverlay.open(id)',
    @label-bound='applyUpdated'
  )

  ScannerDialog(
    v-model='scanOpen',
    :title='$t("marketplace.operatorOwnWarehouse.scanDialogTitle")',
    :idle-caption='$t("marketplace.operatorOwnWarehouse.scanIdleCaption")',
    :manual-label='$t("marketplace.operatorInventoryLabeling.bindLabelManualLabel")',
    manual-placeholder='4600000000000',
    :manual-button='$t("marketplace.operatorOwnWarehouse.scanManualButton")',
    @scanned='onLabelScanned'
  )
  LabelSheetPrintDialog(v-model='printOpen')

  //- Предложение — по ссылке из карточки имущества.
  OfferRegistryOverlay(:coopname='coopname', from='warehouse', :show-full-page='false')
</template>

<style scoped lang="scss">
.warehouse__head-actions {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
}

.warehouse {
  // Внешние отступы держит страница-обёртка «Склад моего КУ» — секция живёт
  // внутри её полосы разделов и своих полей не добавляет.
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__search {
    max-width: 420px;
    width: 100%;
  }

  &__place-input {
    width: 100%;
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
