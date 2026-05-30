<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Loading } from 'quasar'
import { SuccessAlert, FailAlert } from 'src/shared/api'
import { OperatorBranchBar, useOperatorBranchStore } from 'src/entities/OperatorBranch'
import { BarcodeDisplay } from 'src/widgets/Marketplace/BarcodeDisplay'
import { BaseButton, BaseCard, BaseInput, BaseSelect, EmptyState } from 'src/shared/ui/base'
import type { BaseSelectOption } from 'src/shared/ui/base'
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

// Активный КУ оператора — из общего контекста стола (без ввода кода вручную).
const route = useRoute()
const store = useOperatorBranchStore()
const coopname = computed(() => String(route.params.coopname ?? ''))
const braname = computed(() => store.activeBraname ?? '')
const items = ref<MarketplaceInventoryItemView[]>([])
const loading = ref<boolean>(false)

const mode = ref<LabelingMode>('BATCH')
const modeOptions: { label: string; value: LabelingMode }[] = [
  { label: 'Маркировка партии целиком', value: 'BATCH' },
  { label: 'Поштучно по заказу', value: 'PER_ORDER' },
]

const orderIdInput = ref<string>('')

const shipments = ref<MarketplaceShipmentView[]>([])
const selectedShipmentId = ref<string | null>(null)
const defaultStrategy = ref<BarcodeStrategy | null>(null)
// EAN-13 — стандарт маркировки маркетплейса (UX-DR11/DR12), не QR/CODE128.
const defaultFormat = ref<BarcodeFormat>(Zeus.MarketplaceBarcodeFormat.EAN13)
const lastBatchSummary = ref<{ labeled: number; skipped: number } | null>(null)

// «Стратегия по умолчанию» = null (берётся из карточки товара). BaseSelect не
// принимает null в value опций, поэтому используем строковый sentinel и
// мапим его обратно в null через computed-прокси.
const STRATEGY_DEFAULT = '__default__'

const strategyOptions: BaseSelectOption[] = [
  { label: 'По умолчанию из карточки товара', value: STRATEGY_DEFAULT },
  { label: 'Одна этикетка на весь заказ', value: Zeus.MarketplaceBarcodeStrategy.PER_ORDER },
  { label: 'Отдельная этикетка на каждую единицу', value: Zeus.MarketplaceBarcodeStrategy.PER_UNIT },
  { label: 'Этикетка на упаковку', value: Zeus.MarketplaceBarcodeStrategy.PER_PACKAGE },
]

const formatOptions: BaseSelectOption[] = [
  { label: 'CODE128', value: Zeus.MarketplaceBarcodeFormat.CODE128 },
  { label: 'EAN13', value: Zeus.MarketplaceBarcodeFormat.EAN13 },
]

const shipmentOptions = computed<BaseSelectOption[]>(() =>
  shipments.value.map((s) => ({
    label: `${s.id.slice(0, 8)} · ${s.braname} · ${s.delivery_variant} · ${s.status}`,
    value: s.id,
  })),
)

const shipmentModel = computed<string>({
  get: () => selectedShipmentId.value ?? '',
  set: (v) => {
    selectedShipmentId.value = v || null
  },
})

// Допустимые значения enum'ов — для type-guard без каста при приёме строки из
// BaseSelect (sentinel STRATEGY_DEFAULT в список не входит → маппится в null).
const STRATEGY_VALUES: readonly BarcodeStrategy[] = [
  Zeus.MarketplaceBarcodeStrategy.PER_ORDER,
  Zeus.MarketplaceBarcodeStrategy.PER_UNIT,
  Zeus.MarketplaceBarcodeStrategy.PER_PACKAGE,
]
function isStrategy(v: string): v is BarcodeStrategy {
  return STRATEGY_VALUES.some((s) => s === v)
}

const FORMAT_VALUES: readonly BarcodeFormat[] = [
  Zeus.MarketplaceBarcodeFormat.CODE128,
  Zeus.MarketplaceBarcodeFormat.EAN13,
]
function isFormat(v: string): v is BarcodeFormat {
  return FORMAT_VALUES.some((f) => f === v)
}

const strategyModel = computed<string>({
  get: () => defaultStrategy.value ?? STRATEGY_DEFAULT,
  set: (v) => {
    defaultStrategy.value = isStrategy(v) ? v : null
  },
})

const formatModel = computed<string>({
  get: () => defaultFormat.value,
  set: (v) => {
    if (isFormat(v)) defaultFormat.value = v
  },
})

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

watch(braname, () => {
  void loadInventory()
  void loadShipments()
})

onMounted(async () => {
  await store.ensureLoaded(coopname.value)
  await loadShipments()
  await loadInventory()
})
</script>

<template lang="pug">
q-page.labeling(role='region', aria-label='Маркировка имущества')
  OperatorBranchBar

  EmptyState(
    v-if='!store.loading && !store.isOperator',
    title='Вы не оператор кооперативного участка',
    body='Маркировка имущества доступна председателю участка и его доверенным лицам.'
  )
    template(#icon)
      q-icon(name='storefront', size='48px')

  template(v-else)
    .labeling__head.no-print
      .t-h2 Маркировка имущества
      .t-muted Сгенерируйте штрих-коды для прибывших заказов и распечатайте этикетки склада участка.

    .labeling__toolbar.no-print
      q-btn-toggle(
        v-model='mode',
        no-caps,
        unelevated,
        toggle-color='primary',
        :options='modeOptions'
      )
      q-space
      BaseButton(variant='ghost', @click='loadShipments')
        template(#icon-left)
          q-icon(name='refresh', size='18px')
        | Обновить партии
      BaseButton(variant='secondary', :disabled='!items.length', @click='openPrintWindow')
        template(#icon-left)
          q-icon(name='print', size='18px')
        | Печать

    BaseCard.labeling__panel.no-print(
      v-if='mode === "BATCH"',
      title='Маркировка партии целиком'
    )
      .t-muted.labeling__hint
        | Выберите партию поставки и стратегию по умолчанию. Сервер пройдёт по всем
        | заказам партии и сгенерирует этикетки; уже промаркированные пропускаются.
      .labeling__form-row
        BaseSelect.labeling__field(
          v-model='shipmentModel',
          label='Партия поставки',
          :options='shipmentOptions',
          :disabled='!shipmentOptions.length'
        )
        BaseSelect.labeling__field(
          v-model='strategyModel',
          label='Стратегия маркировки',
          :options='strategyOptions'
        )
        BaseSelect.labeling__field(
          v-model='formatModel',
          label='Формат штрих-кода',
          :options='formatOptions'
        )
      .labeling__actions
        BaseButton(variant='primary', :disabled='!selectedShipmentId', @click='generateLabelsForShipment')
          template(#icon-left)
            q-icon(name='qr_code_2', size='16px')
          | Промаркировать партию
        span.t-muted(v-if='lastBatchSummary')
          | Последний прогон: промаркировано {{ lastBatchSummary.labeled }}, пропущено {{ lastBatchSummary.skipped }}.
        span.t-muted(v-else)
          | Стратегия по умолчанию переопределяет настройку из карточки товара только если выбрана явно.

    BaseCard.labeling__panel.no-print(v-else, title='Маркировка одного заказа')
      .labeling__form-row
        BaseInput.labeling__field(
          v-model='orderIdInput',
          label='Идентификатор заказа',
          placeholder='order_id',
          mono
        )
        BaseButton(variant='primary', @click='generateLabelsPerOrder')
          template(#icon-left)
            q-icon(name='qr_code_2', size='16px')
          | Сгенерировать этикетки
      .t-muted
        | Стратегия маркировки берётся из карточки товара поставщика.

    EmptyState.no-print(
      v-if='!items.length',
      title='Этикеток пока нет',
      body='Промаркируйте партию или отдельный заказ — этикетки появятся ниже и будут готовы к печати.'
    )
      template(#icon)
        q-icon(name='qr_code_2', size='48px')

    .labeling__grid(v-else)
      .labeling__label(v-for='item in items', :key='item.id')
        .labeling__label-name.ellipsis {{ item.product_name_snapshot }}
        .labeling__label-meta.ellipsis
          | Пайщик: {{ item.orderer_account_snapshot }} · Кол-во: {{ item.quantity_per_label }}
        BarcodeDisplay(:code='item.barcode_value', size='md')
</template>

<style scoped lang="scss">
.labeling {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__head {
    display: flex;
    flex-direction: column;
    gap: var(--p-1, 4px);
  }

  &__toolbar {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__hint {
    margin-bottom: var(--p-3, 12px);
  }

  &__form-row {
    display: flex;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
    align-items: flex-end;
  }

  &__field {
    flex: 1 1 240px;
    min-width: 200px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
    margin-top: var(--p-3, 12px);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--p-4, 16px);
  }

  &__label {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
    padding: var(--p-3, 12px);
    background: var(--p-surface);
    break-inside: avoid;
  }

  &__label-name {
    font-weight: 600;
  }

  &__label-meta {
    color: var(--p-ink-3);
    font-size: var(--p-fs-body-sm);
    margin-bottom: var(--p-1, 4px);
  }
}

@media (max-width: 768px) {
  .labeling {
    padding: var(--p-4, 16px);
  }
}

@media print {
  .no-print {
    display: none !important;
  }
  .labeling {
    padding: 0;
  }
  .labeling__grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 4mm;
  }
  .labeling__label {
    page-break-inside: avoid;
    width: 100%;
  }
  @page {
    size: A4;
    margin: 8mm;
  }
}
</style>
