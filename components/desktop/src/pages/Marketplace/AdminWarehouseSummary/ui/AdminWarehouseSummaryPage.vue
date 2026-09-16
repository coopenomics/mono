<script lang="ts" setup>
/**
 * Стол администратора → «Склад»: что лежит на пунктах выдачи кооператива.
 *
 * Страница только читает: приёмку, выдачу и списание ведут на столах ПВЗ.
 * Сверху — короткая сводка (сколько позиций, единиц, участков, просрочки и
 * непромаркированного), ниже — таблица с поиском и фильтрами. Строка
 * открывает предложение, по которому имущество попало на склад, — тем же
 * оверлеем, что и реестры предложений и заказов.
 *
 * Рейтинг позиций по обороту переехал на «Экономику»: это денежный срез за
 * период, а не состояние полок.
 */
import { computed, onMounted, ref } from 'vue'
import { debounce } from 'quasar'
import { Zeus } from '@coopenomics/sdk'
import { FailAlert } from 'src/shared/api'
import { useSystemStore } from 'src/entities/System/model'
import { PageHint } from 'src/shared/ui/domain'
import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts/marketplace-units'
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace'
import { useQueryOverlay } from 'src/shared/lib/navigation'
import { OfferRegistryOverlay } from 'src/widgets/Marketplace/OfferRegistryOverlay'
import {
  WarehouseSummaryGrid,
  type WarehouseRow,
} from 'src/widgets/Marketplace/WarehouseSummaryGrid'
import { fetchCategoryNames } from 'src/entities/MarketplaceOffer'
import { listInventory, type MarketplaceInventoryItemView } from 'src/entities/MarketplaceInventory'

const { info } = useSystemStore()
const offerOverlay = useQueryOverlay('offer')

const items = ref<MarketplaceInventoryItemView[]>([])
const categoryNames = ref<Record<number, string>>({})
// true до первого запроса: иначе первый кадр до загрузки показывает пустое
// состояние вместо каркаса, и первая загрузка неотличима от пустого списка.
const loading = ref(true)

async function load(): Promise<void> {
  loading.value = true
  try {
    items.value = await listInventory()
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить склад')
  } finally {
    loading.value = false
  }
}

async function loadCategories(): Promise<void> {
  try {
    categoryNames.value = await fetchCategoryNames()
  } catch {
    // Справочник категорий не критичен: без него фильтр покажет номера.
  }
}

// Realtime вместо кнопки «Обновить»: склад двигают приёмки (акт →
// ACCEPTED_TO_COOP), выдачи (заказ → RECEIVED) и исполненные списания.
// Председатель получает служебный канал персонала КУ по праву admin —
// сигналы всех участков приходят без фильтра.
const reloadLive = debounce(() => {
  if (loading.value) return
  void load()
}, 400)
useMarketplaceRealtime(
  {
    MarketplaceAplReceptionStatusChangedEvent: () => reloadLive(),
    MarketplaceOrderStatusChangedEvent: () => reloadLive(),
    MarketplaceWriteoffStatusChangedEvent: () => reloadLive(),
  },
  { onResync: () => reloadLive() },
)

onMounted(() => {
  void load()
  void loadCategories()
})

// Имущество на складе — то, что физически лежит на участке: принятое,
// промаркированное и возвращённое. Выданное пайщику и списанное со склада
// ушло, но остаётся в приходе и в своей колонке расхода.
function isOnWarehouse(status: MarketplaceInventoryItemView['status']): boolean {
  return (
    status === Zeus.MarketplaceInventoryStatus.RECEIVED ||
    status === Zeus.MarketplaceInventoryStatus.LABELED ||
    status === Zeus.MarketplaceInventoryStatus.RETURNED
  )
}

interface Bucket {
  key: string
  offerId: string | null
  title: string
  categoryId: number | null
  pvzName: string | null
  pvzAddress: string | null
  pvzBraname: string
  unit: string
  incoming: number
  issued: number
  writtenOff: number
  expiryAt: number | null
  unlabeled: number
}

/** Дата в миллисекундах; пусто и мусор — null. */
function timeOf(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const t = new Date(String(value)).getTime()
  return Number.isFinite(t) ? t : null
}

/** Пустая строка сводки по позиции участка — реквизиты берём из первой наклейки. */
function emptyBucket(key: string, row: MarketplaceInventoryItemView): Bucket {
  return {
    key,
    offerId: row.offer_id ?? null,
    title: row.product_name_snapshot,
    categoryId: row.category_id ?? null,
    pvzName: row.delivery_point_name ?? null,
    pvzAddress: row.delivery_point_address ?? null,
    pvzBraname: row.braname,
    unit: marketplaceOrderUnitLabel(row.unit_of_measure),
    incoming: 0,
    issued: 0,
    writtenOff: 0,
    expiryAt: null,
    unlabeled: 0,
  }
}

/** Добавляем в сводку одну наклейку склада. */
function addToBucket(b: Bucket, row: MarketplaceInventoryItemView): void {
  b.incoming += row.quantity_per_label
  if (row.status === Zeus.MarketplaceInventoryStatus.ISSUED) b.issued += row.quantity_per_label
  if (row.status === Zeus.MarketplaceInventoryStatus.WRITTEN_OFF) {
    b.writtenOff += row.quantity_per_label
  }
  if (!isOnWarehouse(row.status)) return
  // Из лежащего на полке берём ближайший срок годности: по нему участок
  // списывает просрочку, и он же тревожит администратора первым.
  const expiry = timeOf(row.expiry_date)
  if (expiry !== null && (b.expiryAt === null || expiry < b.expiryAt)) b.expiryAt = expiry
  if (!row.barcode_value) b.unlabeled += row.quantity_per_label
}

// Группируем по паре (пункт выдачи × позиция): на складе кооператива одна и та
// же позиция может лежать на разных КУ — это разные строки. Позиции одного
// предложения сводим по нему, без предложения — по наименованию товара.
const buckets = computed<Bucket[]>(() => {
  const map = new Map<string, Bucket>()
  for (const row of items.value) {
    const key = `${row.braname}::${row.offer_id ?? row.product_name_snapshot}`
    const bucket = map.get(key) ?? emptyBucket(key, row)
    addToBucket(bucket, row)
    map.set(key, bucket)
  }
  return [...map.values()]
})

const warehouseRows = computed<WarehouseRow[]>(() =>
  buckets.value.map((b) => ({
    key: b.key,
    offerId: b.offerId,
    title: b.title,
    categoryId: b.categoryId,
    categoryName: b.categoryId != null ? (categoryNames.value[b.categoryId] ?? null) : null,
    pvzName: b.pvzName,
    pvzAddress: b.pvzAddress,
    pvzBraname: b.pvzBraname,
    unit: b.unit,
    incoming: b.incoming,
    issued: b.issued,
    writtenOff: b.writtenOff,
    balance: b.incoming - b.issued - b.writtenOff,
    expiryAt: b.expiryAt,
    unlabeled: b.unlabeled,
  })),
)

interface WarehouseStat {
  key: string
  label: string
  value: number
  /** Значение подсвечивается красным, когда оно больше нуля. */
  alarm?: boolean
}

/** Короткая сводка склада — то, на что администратор смотрит первым делом. */
const stats = computed<WarehouseStat[]>(() => {
  const rows = warehouseRows.value
  const inStock = rows.filter((r) => r.balance > 0)
  const now = Date.now()
  return [
    { key: 'positions', label: 'Позиций на складе', value: inStock.length },
    {
      key: 'units',
      label: 'Единиц на остатке',
      value: inStock.reduce((sum, r) => sum + r.balance, 0),
    },
    {
      key: 'points',
      label: 'Пунктов выдачи',
      value: new Set(inStock.map((r) => r.pvzBraname)).size,
    },
    {
      key: 'expired',
      label: 'Позиций с истёкшим сроком',
      value: inStock.filter((r) => r.expiryAt !== null && r.expiryAt < now).length,
      alarm: true,
    },
    {
      key: 'unlabeled',
      label: 'Единиц без штрих-кода',
      value: inStock.reduce((sum, r) => sum + r.unlabeled, 0),
    },
  ]
})

// Строка ведёт на предложение, по которому имущество попало на склад: с него
// видно поставщика, цену, упаковку и участки поставки.
function onRowClick(row: WarehouseRow): void {
  if (!row.offerId) return
  offerOverlay.open(row.offerId)
}
</script>

<template lang="pug">
q-page.warehouse-summary(role='region', aria-label='Склад кооператива')
  PageHint(storage-key='mp:admin-warehouse-summary:banner-dismissed')
    | Склад кооператива: что принято, выдано и списано по каждому пункту выдачи.
    | Только для чтения — операции выполняются на столах ПВЗ. Нажмите на
    | наименование, чтобы открыть предложение, по которому имущество пришло.

  .warehouse-summary__stats
    .warehouse-summary__stat(v-for='s in stats', :key='s.key')
      .warehouse-summary__stat-label {{ s.label }}
      .warehouse-summary__stat-value(
        :class='s.alarm && s.value > 0 ? "warehouse-summary__stat-value--alarm" : ""'
      ) {{ s.value }}

  WarehouseSummaryGrid(:rows='warehouseRows', :loading='loading', @row-click='onRowClick')

  OfferRegistryOverlay(:coopname='info.coopname', from='warehouse')
</template>

<style scoped lang="scss">
.warehouse-summary {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__stats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-3, 12px);
  }

  &__stat {
    flex: 1 1 160px;
    min-width: 150px;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    background: var(--p-surface);
    padding: var(--p-3, 12px) var(--p-4, 16px);
  }

  &__stat-label {
    color: var(--p-ink-3);
    font-size: var(--p-fs-meta, 12px);
  }

  &__stat-value {
    margin-top: var(--p-1, 4px);
    color: var(--p-ink);
    font-size: var(--p-fs-h2, 20px);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  &__stat-value--alarm {
    color: var(--p-neg);
  }
}

@media (max-width: 768px) {
  .warehouse-summary {
    padding: var(--p-4, 16px);
  }
}
</style>
