<template lang="pug">
//- Одна таблица склада для стола ПВЗ и стола администратора (решение владельца
//- 19.11.2026): строка — позиция имущества на складе; нажатие открывает
//- карточку «Имущество на складе». Стол администратора добавляет колонку
//- пункта выдачи; правку места стол ПВЗ передаёт слотом `cell-place`.
BaseTable(
  :columns='columns',
  :rows='rows',
  row-key='id',
  hover,
  sticky-header,
  :loading='loading',
  :min-width='showBranch ? "1180px" : "1040px"',
  sort-by='received',
  descending,
  clickable-rows,
  @row-click='onRowClick'
)
  template(#cell-branch='{ row }')
    .wh-table__stack
      span.wh-table__strong {{ row.delivery_point_name || row.braname }}
      span.wh-table__meta(v-if='row.delivery_point_address') {{ row.delivery_point_address }}

  template(#cell-place='{ row }')
    slot(name='cell-place', :row='row')
      span.wh-table__meta {{ placeLabel(row) }}

  template(#cell-product='{ row }')
    .wh-table__product
      .wh-table__thumb
        img(v-if='row.image_url', :src='row.image_url', :alt='row.product_name_snapshot')
        q-icon(v-else, name='inventory_2', size='18px')
      span.wh-table__strong {{ row.product_name_snapshot }}

  template(#cell-orderer='{ row }')
    .wh-table__stack
      span.wh-table__strong {{ inventoryOrdererName(row) }}
      AccountBadge(:account-name='row.orderer_account_snapshot', size='sm')

  template(#cell-qty='{ row }')
    | {{ inventoryQuantityLabel(row) }}

  template(#cell-status='{ row }')
    BaseBadge(:variant='inventoryStatusVariant(row.status)') {{ inventoryStatusLabel(row.status) }}

  template(#cell-expiry='{ row }')
    span(:class='{ "wh-table__expired": isInventoryExpired(row.expiry_date) }') {{ inventoryDate(row.expiry_date) }}

  template(#cell-received='{ row }')
    | {{ inventoryDateTime(row.received_at) }}

  template(#footer)
    span {{ $t('marketplace.operatorOwnWarehouse.positionsCountFooter', { count: rows.length }) }}
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { BaseBadge, BaseTable } from 'src/shared/ui/base'
import type { BaseTableColumn } from 'src/shared/ui/base'
import { AccountBadge } from 'src/shared/ui/domain'
import {
  inventoryDate,
  inventoryDateTime,
  inventoryOrdererName,
  inventoryQuantityLabel,
  inventoryStatusLabel,
  inventoryStatusVariant,
  inventoryTime,
  isInventoryExpired,
  type MarketplaceInventoryItemView,
} from 'src/entities/MarketplaceInventory'
import { t } from 'src/shared/i18n'

const props = withDefaults(
  defineProps<{
    rows: MarketplaceInventoryItemView[]
    loading?: boolean
    /** Колонка пункта выдачи — склад всего кооператива (стол администратора). */
    showBranch?: boolean
    /** Подпись места хранения позиции. */
    placeLabel: (row: MarketplaceInventoryItemView) => string
  }>(),
  { loading: false, showBranch: false },
)

const emit = defineEmits<{ (e: 'row-click', row: MarketplaceInventoryItemView): void }>()

function onRowClick(row: MarketplaceInventoryItemView): void {
  emit('row-click', row)
}

const columns = computed<BaseTableColumn<MarketplaceInventoryItemView>[]>(() => [
  ...(props.showBranch
    ? [{ key: 'branch', label: t('marketplace.warehouseInventoryTable.branch'), width: '200px', sortable: true, field: (row: MarketplaceInventoryItemView) => row.delivery_point_name || row.braname }]
    : []),
  { key: 'product', label: t('marketplace.operatorOwnWarehouse.column.product'), width: '240px', sortable: true, field: 'product_name_snapshot' },
  { key: 'orderer', label: t('marketplace.operatorOwnWarehouse.column.orderer'), width: '200px', sortable: true, field: (row) => inventoryOrdererName(row) },
  { key: 'qty', label: t('marketplace.operatorOwnWarehouse.column.qty'), width: '130px', numeric: true, nowrap: true },
  { key: 'place', label: t('marketplace.operatorOwnWarehouse.column.place'), width: '200px', field: (row) => props.placeLabel(row) },
  { key: 'status', label: t('marketplace.operatorOwnWarehouse.column.status'), width: '130px', nowrap: true, sortable: true, field: 'status' },
  { key: 'expiry', label: t('marketplace.operatorOwnWarehouse.column.expiry'), width: '120px', nowrap: true, sortable: true, field: (row) => inventoryTime(row.expiry_date) },
  { key: 'received', label: t('marketplace.operatorOwnWarehouse.column.received'), width: '150px', nowrap: true, sortable: true, field: (row) => inventoryTime(row.received_at) },
])
</script>

<style scoped lang="scss">
.wh-table {
  &__stack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__strong {
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__meta {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }

  &__product {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    min-width: 0;
  }

  &__thumb {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: var(--p-r-sm);
    background: var(--p-surface-2);
    display: grid;
    place-items: center;
    overflow: hidden;
    color: var(--p-ink-3);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  // Просроченный срок годности — красным: пора списывать.
  &__expired {
    color: var(--p-neg);
    font-weight: 600;
  }
}
</style>
