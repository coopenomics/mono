<script setup lang="ts">
/**
 * Партия отгрузки — боковой панелью поверх стола поставщика.
 *
 * В таблице видны только цикл, участок, вариант доставки, статус и сумма — по
 * ним нельзя понять ни что в партии едет, ни кому, ни по какой накладной.
 * Здесь собрано всё, что о партии известно: реквизиты доставки, накладная с
 * данными экспедитора и поштучный состав — какие заказы, чьи и на какую сумму.
 *
 * Состав грузится по требованию: заказы партии нужны только когда её открыли.
 */
import { computed } from 'vue'
import { BaseBadge, BaseButton, BaseTable, EmptyState } from 'src/shared/ui/base'
import type { BaseBadgeVariant, BaseTableColumn } from 'src/shared/ui/base'
import { DataRow, DetailsDrawer } from 'src/shared/ui/domain'
import { EntityIdBadge } from 'src/shared/ui/EntityIdBadge'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates'
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units'
import type {
  ShipmentDetailsOrderLine,
  ShipmentDetailsSummary,
} from './ShipmentDetailsDrawer.types'

const props = defineProps<{
  modelValue: boolean
  /** Открытая партия; null — панель закрыта. */
  shipment: ShipmentDetailsSummary | null
  /** Заказы партии — их грузит стол, панель только показывает. */
  orders: ShipmentDetailsOrderLine[]
  /** Идёт ли загрузка состава. */
  loading?: boolean
  /** Наименование участка-получателя. */
  branchName?: string
  /** Адрес участка-получателя. */
  branchAddress?: string
  /** Подпись статуса партии и её вариант — те же, что в таблице стола. */
  statusLabel?: string
  statusVariant?: BaseBadgeVariant
  /** Подпись способа доставки. */
  deliveryLabel?: string
  /** Что делать дальше по этой партии. */
  nextStep?: string
  /** Доступна ли печать накладной. */
  canPrintTtn?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'print-ttn': [shipment: ShipmentDetailsSummary]
}>()

const items = computed(() =>
  props.shipment ? props.orders.filter((o) => o.shipment_id === props.shipment?.id) : [],
)

const itemsTotal = computed(() =>
  items.value.reduce((sum, o) => sum + (Number.parseFloat(String(o.total_cost)) || 0), 0),
)

const title = computed(() => 'Партия отгрузки')

function formatDate(value: unknown): string {
  return formatDateToLocalTimezone(value, 'DD.MM.YYYY HH:mm') || '—'
}

/** Количество в единицах отпуска: «4 упак. 1 л», «3 кг». */
function quantityLabel(order: ShipmentDetailsOrderLine): string {
  const saleUnit = marketplaceOrderSaleUnit(
    order.quantity,
    order.unit_of_measure,
    order.package_size,
  )
  return `${saleUnit.units} ${saleUnit.unitLabel}`
}

function ordererName(order: ShipmentDetailsOrderLine): string {
  return order.orderer_name?.trim() || order.orderer_account
}

const columns: BaseTableColumn<ShipmentDetailsOrderLine>[] = [
  { key: 'product', label: 'Товар', width: '220px', field: 'product_name' },
  { key: 'orderer', label: 'Заказчик', width: '190px' },
  { key: 'quantity', label: 'Кол-во', width: '120px', numeric: true },
  { key: 'cost', label: 'Сумма', width: '130px', numeric: true },
]

/** Данные накладной показываем только когда они есть — у самовывоза их нет. */
const ttn = computed(() => props.shipment?.ttn_data ?? null)
const hasTtnDetails = computed(() => {
  const d = ttn.value
  if (!d) return false
  return Boolean(
    d.expeditor_full_name ||
      d.expeditor_phone ||
      d.vehicle_number ||
      d.loading_address ||
      d.loading_datetime ||
      d.delivery_datetime_estimate,
  )
})
</script>

<template lang="pug">
DetailsDrawer(
  :model-value='modelValue',
  :width='760',
  :title='title',
  @update:model-value='(v) => emit("update:modelValue", v)'
)
  template(#actions)
    BaseButton(
      v-if='canPrintTtn && shipment',
      variant='ghost',
      size='sm',
      @click='emit("print-ttn", shipment)'
    )
      template(#icon-left)
        q-icon(name='print', size='16px')
      | Накладная

  .shipment-details(v-if='shipment')
    .shipment-details__head
      BaseBadge(v-if='statusLabel', :variant='statusVariant ?? "neutral"') {{ statusLabel }}
      EntityIdBadge(
        v-if='shipment.cycle_id',
        :raw-id='String(shipment.cycle_id).slice(0, 8)',
        :copy-value='shipment.cycle_id',
        copy-on-click
      )

    .shipment-details__next(v-if='nextStep') {{ nextStep }}

    .shipment-details__facts
      DataRow(v-if='branchName', label='Пункт назначения', :value='branchName')
      DataRow(v-if='branchAddress', label='Адрес участка', :value='branchAddress')
      DataRow(v-if='deliveryLabel', label='Способ доставки', :value='deliveryLabel')
      DataRow(label='Сумма партии', :value='`${formatAsset2Digits(shipment.total_amount)} ₽`')
      DataRow(label='Сформирована', :value='formatDate(shipment.created_at)')
      DataRow(v-if='shipment.ttn_number', label='Накладная №', :value='shipment.ttn_number')

    template(v-if='hasTtnDetails && ttn')
      .t-h3.shipment-details__section Перевозка
      .shipment-details__facts
        DataRow(v-if='ttn.expeditor_full_name', label='Экспедитор', :value='ttn.expeditor_full_name')
        DataRow(v-if='ttn.expeditor_phone', label='Телефон', :value='ttn.expeditor_phone')
        DataRow(v-if='ttn.vehicle_number', label='Машина', :value='ttn.vehicle_number')
        DataRow(v-if='ttn.loading_address', label='Адрес погрузки', :value='ttn.loading_address')
        DataRow(
          v-if='ttn.loading_datetime',
          label='Погрузка',
          :value='formatDate(ttn.loading_datetime)'
        )
        DataRow(
          v-if='ttn.delivery_datetime_estimate',
          label='Доставка ожидается',
          :value='formatDate(ttn.delivery_datetime_estimate)'
        )

    .t-h3.shipment-details__section Состав партии

    BaseTable(
      v-if='loading || items.length',
      :columns='columns',
      :rows='items',
      row-key='id',
      hover,
      :loading='loading',
      :skeleton-rows='3',
      min-width='660px'
    )
      template(#cell-orderer='{ row }')
        | {{ ordererName(row) }}
      template(#cell-quantity='{ row }')
        | {{ quantityLabel(row) }}
      template(#cell-cost='{ row }')
        | {{ formatAsset2Digits(row.total_cost) }} ₽
      template(#footer)
        .shipment-details__foot
          span Заказов: {{ items.length }}
          span {{ formatAsset2Digits(String(itemsTotal)) }} ₽

    EmptyState(
      v-else,
      title='Состав не найден',
      body='Заказы этой партии не попали в выборку стола — возможно, они старше последних загруженных.'
    )
      template(#icon)
        q-icon(name='local_shipping', size='48px')
</template>

<style scoped lang="scss">
.shipment-details {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);
  }

  &__next {
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: var(--p-lh-body-sm, 1.5);
  }

  &__facts {
    display: flex;
    flex-direction: column;
  }

  &__section {
    margin-top: var(--p-2, 8px);
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    width: 100%;
  }
}
</style>
