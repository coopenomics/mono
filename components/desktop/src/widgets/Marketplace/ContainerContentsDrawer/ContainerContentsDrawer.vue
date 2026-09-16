<script setup lang="ts">
/**
 * Содержимое бокса — боковой панелью поверх реестра тары.
 *
 * В реестре видно только «сколько позиций лежит», а вопрос у смотрящего
 * другой: что именно там лежит и чьё оно. Идти ради этого на склад участка —
 * терять место в списке, поэтому состав открывается прямо здесь.
 *
 * Панель ничего не грузит сама: позиции склада уже есть у реестра, который её
 * открывает. Так же устроен счётчик заполненности — он считается из склада,
 * а не хранится у бокса.
 */
import { computed } from 'vue'
import { Zeus } from '@coopenomics/sdk'
import { BaseBadge, BaseTable, EmptyState } from 'src/shared/ui/base'
import type { BaseBadgeVariant, BaseTableColumn } from 'src/shared/ui/base'
import { DataRow, DetailsDrawer } from 'src/shared/ui/domain'
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates'
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units'
import type { MarketplaceContainerView } from 'src/entities/MarketplaceStorage'
import type { MarketplaceInventoryItemView } from 'src/entities/MarketplaceInventory'

const props = defineProps<{
  modelValue: boolean
  /** Открытый бокс; null — панель закрыта. */
  container: MarketplaceContainerView | null
  /** Позиции склада, лежащие в этом боксе. */
  items: MarketplaceInventoryItemView[]
  /** Наименование участка, где стоит бокс. */
  branchName?: string
  /** Адрес участка — отдельной строкой под наименованием. */
  branchAddress?: string
  /** Название типа тары. */
  typeName?: string
  /** Объём типа тары, как он показан в реестре. */
  volume?: string
  /** Код ячейки, в которой стоит бокс. */
  cellCode?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const STATUS: Record<string, { label: string; variant: BaseBadgeVariant }> = {
  [Zeus.MarketplaceInventoryStatus.RECEIVED]: { label: 'Принято', variant: 'neutral' },
  [Zeus.MarketplaceInventoryStatus.LABELED]: { label: 'Промаркировано', variant: 'info' },
  [Zeus.MarketplaceInventoryStatus.ISSUED]: { label: 'Выдано', variant: 'pos' },
  [Zeus.MarketplaceInventoryStatus.RETURNED]: { label: 'Возврат на склад', variant: 'warn' },
  [Zeus.MarketplaceInventoryStatus.WRITTEN_OFF]: { label: 'Списано', variant: 'neg' },
}

function statusLabel(status: string): string {
  return STATUS[status]?.label ?? status
}
function statusVariant(status: string): BaseBadgeVariant {
  return STATUS[status]?.variant ?? 'neutral'
}

/** «4» без единицы непонятно, чего именно — штук, кг, упаковок. */
function quantityLabel(row: MarketplaceInventoryItemView): string {
  const saleUnit = marketplaceOrderSaleUnit(
    row.quantity_per_label,
    row.unit_of_measure,
    row.package_size,
  )
  return `${saleUnit.units} ${saleUnit.unitLabel}`
}

function ordererName(row: MarketplaceInventoryItemView): string {
  return row.orderer_name?.trim() || row.orderer_account_snapshot
}

function formatDate(value: unknown): string {
  return formatDateToLocalTimezone(value, 'DD.MM.YYYY') || '—'
}

const columns: BaseTableColumn<MarketplaceInventoryItemView>[] = [
  { key: 'product', label: 'Позиция', width: '200px', field: 'product_name_snapshot' },
  { key: 'qty', label: 'Кол-во', width: '110px', numeric: true, nowrap: true },
  { key: 'orderer', label: 'Заказчик', width: '180px' },
  { key: 'status', label: 'Состояние', width: '150px' },
  { key: 'expiry', label: 'Годен до', width: '120px', nowrap: true },
]

const title = computed(() =>
  props.container ? `Бокс ${props.container.code}` : 'Бокс',
)

/** Сводка по боксу: сколько позиций и сколько единиц имущества внутри. */
const summary = computed(() => {
  const units = props.items.reduce((sum, i) => sum + i.quantity_per_label, 0)
  return { positions: props.items.length, units }
})
</script>

<template lang="pug">
DetailsDrawer(
  :model-value='modelValue',
  :width='720',
  :title='title',
  @update:model-value='(v) => emit("update:modelValue", v)'
)
  .box-contents(v-if='container')
    .box-contents__facts
      DataRow(v-if='branchName', label='Участок', :value='branchName')
      DataRow(v-if='branchAddress', label='Адрес участка', :value='branchAddress')
      DataRow(v-if='typeName', label='Тип тары', :value='typeName')
      DataRow(v-if='volume', label='Объём', :value='volume')
      DataRow(label='Ячейка', :value='cellCode || "Без адреса"')
      DataRow(v-if='container.label', label='Подпись партии', :value='container.label')

    BaseTable(
      v-if='items.length',
      :columns='columns',
      :rows='items',
      row-key='id',
      hover,
      min-width='660px'
    )
      template(#cell-qty='{ row }')
        | {{ quantityLabel(row) }}
      template(#cell-orderer='{ row }')
        | {{ ordererName(row) }}
      template(#cell-status='{ row }')
        BaseBadge(:variant='statusVariant(row.status)') {{ statusLabel(row.status) }}
      template(#cell-expiry='{ row }')
        | {{ formatDate(row.expiry_date) }}
      template(#footer)
        span Позиций: {{ summary.positions }} · единиц: {{ summary.units }}

    EmptyState(
      v-else,
      title='Бокс пуст',
      body='В этом боксе сейчас ничего не лежит. Имущество кладёт в него оператор участка при раскладке.'
    )
      template(#icon)
        q-icon(name='inbox', size='48px')
</template>

<style scoped lang="scss">
.box-contents {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__facts {
    display: flex;
    flex-direction: column;
  }
}
</style>
