<template lang="pug">
//- Карточка «Имущество на складе» (решение владельца 19.11.2026): где лежит,
//- чьё, когда и кем принято, сроки, маркировка. Предложение — ссылкой внизу,
//- а не вместо карточки. Одна на склад ПВЗ и склад стола администратора;
//- адрес держит `?item=<позиция>`.
DetailsDrawer(
  :model-value='isOpen',
  :width='560',
  :title='$t("marketplace.inventoryItemDrawer.title")',
  @update:model-value='onToggle'
)
  .inv-item(v-if='item')
    //- Опознание: обложка, имущество, количество; состояние — бейджем.
    .inv-item__head
      .inv-item__thumb
        img(v-if='item.image_url', :src='item.image_url', :alt='item.product_name_snapshot')
        q-icon(v-else, name='inventory_2', size='28px')
      .inv-item__head-text
        .inv-item__name {{ item.product_name_snapshot }}
        .inv-item__qty {{ inventoryQuantityLabel(item) }}
      BaseBadge(:variant='inventoryStatusVariant(item.status)') {{ inventoryStatusLabel(item.status) }}

    .inv-item__section {{ $t('marketplace.inventoryItemDrawer.whereTitle') }}
    DataRow(:label='$t("marketplace.inventoryItemDrawer.branchLabel")', align='vertical')
      template(#value-override)
        .inv-item__stack
          span {{ item.delivery_point_name || item.braname }}
          span.inv-item__muted(v-if='item.delivery_point_address') {{ item.delivery_point_address }}
    DataRow(:label='$t("marketplace.inventoryItemDrawer.placeLabel")', :value='placeLabel(item)', align='spread')
    DataRow(:label='$t("marketplace.inventoryItemDrawer.ordererLabel")', align='spread')
      template(#value-override)
        .inv-item__stack.inv-item__stack--end
          span {{ inventoryOrdererName(item) }}
          AccountBadge(:account-name='item.orderer_account_snapshot', size='sm')

    .inv-item__section {{ $t('marketplace.inventoryItemDrawer.receptionTitle') }}
    DataRow(:label='$t("marketplace.inventoryItemDrawer.receivedAtLabel")', :value='inventoryDateTime(item.received_at)', align='spread')
    DataRow(:label='$t("marketplace.inventoryItemDrawer.receivedByLabel")', align='spread')
      template(#value-override)
        AccountBadge(:account-name='item.received_by_operator_account', size='sm')
    DataRow(:label='$t("marketplace.inventoryItemDrawer.originLabel")', :value='originLabel', align='spread')

    .inv-item__section {{ $t('marketplace.inventoryItemDrawer.termsTitle') }}
    DataRow(:label='$t("marketplace.inventoryItemDrawer.expiryLabel")', align='spread')
      template(#value-override)
        span(:class='{ "inv-item__expired": isInventoryExpired(item.expiry_date) }') {{ inventoryDate(item.expiry_date) }}
    DataRow(:label='$t("marketplace.inventoryItemDrawer.warrantyLabel")', :value='warrantyText', align='spread')

    .inv-item__section {{ $t('marketplace.inventoryItemDrawer.labelTitle') }}
    DataRow(:label='$t("marketplace.inventoryItemDrawer.barcodeLabel")', align='spread')
      template(#value-override)
        span.q-mono(v-if='item.barcode_value') {{ item.barcode_value }}
        span.inv-item__muted(v-else) {{ $t('marketplace.inventoryItemDrawer.noBarcode') }}
    DataRow(
      v-if='item.labeled_at',
      :label='$t("marketplace.inventoryItemDrawer.labeledAtLabel")',
      :value='inventoryDateTime(item.labeled_at)',
      align='spread'
    )

  template(v-if='item', #footer)
    .inv-item__actions
      //- Действия стола: выпуск штрих-кода у оператора ПВЗ.
      slot(name='actions', :item='item')
      BaseButton(v-if='item.order_id', variant='secondary', size='sm', @click='openOrder')
        template(#icon-left)
          q-icon(name='receipt_long', size='16px')
        | {{ $t('marketplace.inventoryItemDrawer.openOrder') }}
      BaseButton(v-if='item.offer_id', variant='secondary', size='sm', @click='openOffer')
        template(#icon-left)
          q-icon(name='storefront', size='16px')
        | {{ $t('marketplace.inventoryItemDrawer.openOffer') }}
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'
import { BaseBadge, BaseButton } from 'src/shared/ui/base'
import { AccountBadge, DataRow, DetailsDrawer } from 'src/shared/ui/domain'
import { useQueryOverlay } from 'src/shared/lib/navigation'
import { fetchOffer } from 'src/entities/MarketplaceOffer'
import {
  inventoryDate,
  inventoryDateTime,
  inventoryOrdererName,
  inventoryQuantityLabel,
  inventoryStatusLabel,
  inventoryStatusVariant,
  isInventoryExpired,
  type MarketplaceInventoryItemView,
} from 'src/entities/MarketplaceInventory'
import { t } from 'src/shared/i18n'

const props = defineProps<{
  /** Позиции склада, среди которых ищется открытая (`?item=`). */
  items: MarketplaceInventoryItemView[]
  /** Подпись места хранения позиции. */
  placeLabel: (row: MarketplaceInventoryItemView) => string
  /** Маршрут карточки заказа на этом столе. */
  orderRouteName: string
}>()

const emit = defineEmits<{ (e: 'open-offer', offerId: string): void }>()

const overlay = useQueryOverlay('item')
const route = useRoute()
const router = useRouter()

const item = computed(() => {
  const id = overlay.value.value
  return id ? props.items.find((row) => row.id === id) ?? null : null
})
const isOpen = computed(() => overlay.isOpen.value && !!item.value)

function onToggle(open: boolean): void {
  if (!open) overlay.close()
}

const originLabel = computed(() =>
  item.value?.origin === Zeus.MarketplaceInventoryOrigin.WARRANTY_RETURN
    ? t('marketplace.inventoryItemDrawer.originWarrantyReturn')
    : t('marketplace.inventoryItemDrawer.originReception'),
)

// Гарантийный срок возврата задан в предложении: дочитываем его при открытии
// карточки. Срок отсчитывается от выдачи заказчику.
const warrantyDays = ref<number | null>(null)
watch(
  () => item.value?.offer_id ?? null,
  async (offerId) => {
    warrantyDays.value = null
    if (!offerId) return
    try {
      const offer = await fetchOffer(String(offerId))
      warrantyDays.value = offer?.warranty_days ?? null
    } catch {
      warrantyDays.value = null
    }
  },
  { immediate: true },
)
const warrantyText = computed(() =>
  warrantyDays.value === null
    ? '—'
    : t('marketplace.inventoryItemDrawer.warrantyValue', { days: warrantyDays.value }),
)

function openOrder(): void {
  if (!item.value?.order_id) return
  void router.push({
    name: props.orderRouteName,
    params: { coopname: String(route.params.coopname ?? ''), orderId: String(item.value.order_id) },
  })
}

function openOffer(): void {
  if (item.value?.offer_id) emit('open-offer', String(item.value.offer_id))
}
</script>

<style scoped lang="scss">
.inv-item {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);

  &__head {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--p-3, 12px);
    margin-bottom: var(--p-2, 8px);
  }

  &__thumb {
    width: 72px;
    height: 72px;
    border-radius: var(--p-r-md);
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

  &__name {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__qty {
    color: var(--p-ink-2);
  }

  &__section {
    margin-top: var(--p-3, 12px);
    font-size: var(--p-fs-eyebrow);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink-3);
  }

  &__stack {
    display: flex;
    flex-direction: column;
    gap: 2px;

    &--end {
      align-items: flex-end;
    }
  }

  &__muted {
    color: var(--p-ink-3);
  }

  &__expired {
    color: var(--p-neg);
    font-weight: 600;
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);
  }
}
</style>
