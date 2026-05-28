<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { Loading } from 'quasar'
import { SuccessAlert, FailAlert } from 'src/shared/api'
import { BarcodeDisplay } from 'src/widgets/Marketplace/BarcodeDisplay'
import { Zeus } from '@coopenomics/sdk'
import {
  fetchInventoryByBraname,
  fetchShipmentsForLabeling,
  labelInventory,
  labelShipmentInventory,
  type MarketplaceInventoryItemView,
  type MarketplaceShipmentView,
} from '../api'

type LabelingMode = 'PER_ORDER' | 'BATCH'
type BarcodeStrategy = Zeus.MarketplaceBarcodeStrategy
type BarcodeFormat = Zeus.MarketplaceBarcodeFormat

const braname = ref<string>('')
const items = ref<MarketplaceInventoryItemView[]>([])
const loading = ref<boolean>(false)

const mode = ref<LabelingMode>('BATCH')

const orderIdInput = ref<string>('')

const shipments = ref<MarketplaceShipmentView[]>([])
const selectedShipmentId = ref<string | null>(null)
const defaultStrategy = ref<BarcodeStrategy | null>(null)
// EAN-13 — стандарт маркировки маркетплейса (UX-DR11/DR12), не QR/CODE128.
const defaultFormat = ref<BarcodeFormat>(Zeus.MarketplaceBarcodeFormat.EAN13)
const lastBatchSummary = ref<{ labeled: number; skipped: number } | null>(null)

const strategyOptions: Array<{ label: string; value: BarcodeStrategy | null }> = [
  { label: 'По умолчанию из карточки товара', value: null },
  { label: 'Одна этикетка на весь заказ', value: Zeus.MarketplaceBarcodeStrategy.PER_ORDER },
  { label: 'Отдельная этикетка на каждую единицу', value: Zeus.MarketplaceBarcodeStrategy.PER_UNIT },
  { label: 'Этикетка на упаковку', value: Zeus.MarketplaceBarcodeStrategy.PER_PACKAGE },
]

const formatOptions: Array<{ label: string; value: BarcodeFormat }> = [
  { label: 'CODE128', value: Zeus.MarketplaceBarcodeFormat.CODE128 },
  { label: 'EAN13', value: Zeus.MarketplaceBarcodeFormat.EAN13 },
]

const shipmentOptions = computed(() =>
  shipments.value.map((s) => ({
    label: `${s.id.slice(0, 8)} · ${s.braname} · ${s.delivery_variant} · ${s.status}`,
    value: s.id,
  })),
)

async function loadInventory(): Promise<void> {
  if (!braname.value.trim()) return
  loading.value = true
  try {
    items.value = await fetchInventoryByBraname(braname.value.trim())
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить инвентарь')
  } finally {
    loading.value = false
  }
}

async function loadShipments(): Promise<void> {
  try {
    shipments.value = await fetchShipmentsForLabeling(braname.value.trim() || undefined)
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить список партий')
  }
}

async function generateLabelsPerOrder(): Promise<void> {
  if (!orderIdInput.value.trim()) {
    FailAlert(new Error('Укажите идентификатор заказа.'))
    return
  }
  Loading.show({ message: 'Генерирую этикетки…' })
  try {
    const result = await labelInventory({ order_id: orderIdInput.value.trim() })
    SuccessAlert(`Сгенерировано ${result.inventory.length} этикеток — можно печатать`)
    orderIdInput.value = ''
    await loadInventory()
  } catch (e) {
    FailAlert(e, 'Не удалось сгенерировать этикетки')
  } finally {
    Loading.hide()
  }
}

async function generateLabelsForShipment(): Promise<void> {
  if (!selectedShipmentId.value) {
    FailAlert(new Error('Выберите партию для маркировки.'))
    return
  }
  Loading.show({ message: 'Маркирую партию…' })
  try {
    const result = await labelShipmentInventory({
      shipment_id: selectedShipmentId.value,
      default_strategy: defaultStrategy.value ?? undefined,
      format: defaultFormat.value,
    })
    lastBatchSummary.value = {
      labeled: result.labeled_order_ids.length,
      skipped: result.skipped_order_ids.length,
    }
    const skipNote = result.skipped_order_ids.length
      ? ` Пропущено уже промаркированных: ${result.skipped_order_ids.length}.`
      : ''
    SuccessAlert(
      `Партия промаркирована. Заказов в работе: ${result.labeled_order_ids.length}.${skipNote} Готовы к печати ${result.inventory.length} этикеток.`,
    )
    if (!braname.value && result.inventory[0]?.braname) {
      braname.value = result.inventory[0].braname
    }
    await loadInventory()
  } catch (e) {
    FailAlert(e, 'Не удалось промаркировать партию')
  } finally {
    Loading.hide()
  }
}

function openPrintWindow(): void {
  window.print()
}

onMounted(async () => {
  await loadShipments()
})
</script>

<template lang="pug">
q-page.mp-role-operator.mp-inventory-labeling.q-pa-md
  .row.q-mb-md.q-gutter-md.no-print.items-center
    q-input.col-3(
      v-model="braname"
      dense
      outlined
      label="ID кооперативного участка"
      @keyup.enter="loadInventory"
    )
    q-btn(no-caps color="primary" :loading="loading" label="Загрузить инвентарь" @click="loadInventory")
    q-btn(flat no-caps icon="refresh" label="Обновить список партий" @click="loadShipments")
    q-space
    q-btn(flat no-caps icon="print" label="Печать партии" :disable="!items.length" @click="openPrintWindow")

  .row.q-mb-md.no-print
    q-btn-toggle(
      v-model="mode"
      no-caps
      unelevated
      toggle-color="primary"
      :options="[{ label: 'Маркировка партии целиком', value: 'BATCH' }, { label: 'Поштучно по заказу', value: 'PER_ORDER' }]"
    )

  q-card.q-mb-md.no-print(flat bordered v-if="mode === 'BATCH'")
    q-card-section
      .text-subtitle2.q-mb-sm Маркировка партии целиком
      .text-caption.text-grey-7.q-mb-md
        | Выберите партию поставки и стратегию по умолчанию. Сервер сам пройдёт по всем заказам партии и сгенерирует этикетки.
        | Уже промаркированные заказы пропускаются автоматически.
      .row.q-gutter-md.q-mb-sm
        q-select.col-5(
          v-model="selectedShipmentId"
          dense
          outlined
          emit-value
          map-options
          label="Партия поставки"
          :options="shipmentOptions"
          :disable="!shipmentOptions.length"
        )
        q-select.col-3(
          v-model="defaultStrategy"
          dense
          outlined
          emit-value
          map-options
          label="Стратегия маркировки по умолчанию"
          :options="strategyOptions"
        )
        q-select.col-3(
          v-model="defaultFormat"
          dense
          outlined
          emit-value
          map-options
          label="Формат штрих-кода"
          :options="formatOptions"
        )
      .row.q-gutter-md.items-center
        q-btn(
          no-caps
          unelevated
          color="primary"
          label="Промаркировать партию"
          :disable="!selectedShipmentId"
          @click="generateLabelsForShipment"
        )
        span.text-caption.text-grey-7(v-if="lastBatchSummary")
          | Последний прогон: промаркировано {{ lastBatchSummary.labeled }}, пропущено {{ lastBatchSummary.skipped }}.
        span.text-caption.text-grey-7(v-else)
          | Стратегия по умолчанию переопределяет per-Offer настройку только если выбрана явно.

  q-card.q-mb-md.no-print(flat bordered v-else)
    q-card-section
      .text-subtitle2.q-mb-sm Маркировка одного заказа
      .row.q-gutter-md
        q-input.col-4(
          v-model="orderIdInput"
          dense
          outlined
          label="ID заказа для маркировки"
        )
        q-btn(no-caps unelevated color="primary" label="Сгенерировать этикетки" @click="generateLabelsPerOrder")
        span.text-caption.text-grey-7.self-center
          | Стратегия маркировки берётся из карточки товара поставщика (per-Offer).

  .text-grey-7.text-center.q-pa-xl.no-print(v-if="!items.length")
    | Инвентарь пуст. Загрузите КУ, промаркируйте партию или отдельный заказ — этикетки появятся справа.

  .mp-inventory-labeling__grid(v-else)
    .mp-inventory-labeling__label(v-for="item in items" :key="item.id")
      .text-subtitle2.ellipsis {{ item.product_name_snapshot }}
      .text-caption.text-grey-7.ellipsis.q-mb-xs
        | Пайщик: {{ item.orderer_account_snapshot }} · Кол-во: {{ item.quantity_per_label }}
      BarcodeDisplay(:code="item.barcode_value" size="md")
</template>

<style scoped lang="scss">
.mp-inventory-labeling {
  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--mp-space-md);
  }

  &__label {
    border: 1px solid var(--mp-border-color, #e0e0e0);
    border-radius: var(--mp-radius-sm, 4px);
    padding: var(--mp-space-sm);
    background: #fff;
    break-inside: avoid;
  }
}

@media print {
  .no-print { display: none !important; }
  .mp-inventory-labeling__grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 4mm;
  }
  .mp-inventory-labeling__label {
    page-break-inside: avoid;
    width: 100%;
  }
  @page {
    size: A4;
    margin: 8mm;
  }
}
</style>
