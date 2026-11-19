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

    //- Журнал движения: приёмка, размещение, маркировка, выдача, списание —
    //- кто, когда и где. Пишет база узла при каждом изменении позиции.
    .inv-item__section {{ $t('marketplace.inventoryItemDrawer.historyTitle') }}
    ActivityTimeline(v-if='historyEvents.length', :events='historyEvents')
    .inv-item__muted(v-else-if='!historyLoading') {{ $t('marketplace.inventoryItemDrawer.historyEmpty') }}

  template(v-if='item', #footer)
    .inv-item__actions
      //- Этикетку не выпускают в карточке: её печатают заранее листом, клеят
      //- на имущество и привязывают сканером (решение владельца 19.11.2026).
      BaseButton(
        v-if='labelable && !item.barcode_value',
        variant='secondary',
        size='sm',
        @click='bindOpen = true'
      )
        template(#icon-left)
          q-icon(name='qr_code_scanner', size='16px')
        | {{ $t('marketplace.inventoryItemDrawer.bindLabel') }}
      slot(name='actions', :item='item')
      BaseButton(v-if='item.order_id', variant='secondary', size='sm', @click='openOrder')
        template(#icon-left)
          q-icon(name='receipt_long', size='16px')
        | {{ $t('marketplace.inventoryItemDrawer.openOrder') }}
      BaseButton(v-if='item.offer_id', variant='secondary', size='sm', @click='openOffer')
        template(#icon-left)
          q-icon(name='storefront', size='16px')
        | {{ $t('marketplace.inventoryItemDrawer.openOffer') }}

InventoryLabelBindDialog(
  v-model='bindOpen',
  :item='item',
  @bound='(rows) => emit("label-bound", rows)'
)

//- Заказ открывается правой панелью поверх карточки (`?order=`), предложение —
//- панелью стола (`?offer=`): закрытие панели возвращает к карточке имущества,
//- склад под ними остаётся на месте (замечание владельца 19.11.2026).
OrderRegistryOverlay(
  :coopname='coopname',
  :full-page-route-name='orderRouteName',
  show-offer-link,
  @offer-click='(id) => emit("open-offer", id)'
)
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'
import { BaseBadge, BaseButton } from 'src/shared/ui/base'
import { AccountBadge, ActivityTimeline, DataRow, DetailsDrawer } from 'src/shared/ui/domain'
import type { ActivityEvent, ActivityEventType } from 'src/shared/ui/domain'
import { useLiveReload } from 'src/shared/lib/realtime'
import { marketLiveTables } from 'src/shared/lib/marketplace'
import { useQueryOverlay } from 'src/shared/lib/navigation'
import { fetchOffer } from 'src/entities/MarketplaceOffer'
import { OrderRegistryOverlay } from 'src/widgets/Marketplace/OrderRegistryOverlay'
import { InventoryLabelBindDialog } from 'src/widgets/Marketplace/InventoryLabelBindDialog'
import {
  inventoryDate,
  inventoryDateTime,
  inventoryOrdererName,
  inventoryQuantityLabel,
  inventoryStatusLabel,
  inventoryStatusVariant,
  isInventoryExpired,
  fetchInventoryMovements,
  type MarketplaceInventoryItemView,
  type MarketplaceInventoryMovementView,
} from 'src/entities/MarketplaceInventory'
import { t } from 'src/shared/i18n'

const props = defineProps<{
  /** Позиции склада, среди которых ищется открытая (`?item=`). */
  items: MarketplaceInventoryItemView[]
  /** Подпись места хранения позиции. */
  placeLabel: (row: MarketplaceInventoryItemView) => string
  /** Маршрут полной страницы заказа на этом столе — кнопка в панели заказа. */
  orderRouteName: string
  /** Оператор участка привязывает наклеенную этикетку к позиции сканером. */
  labelable?: boolean
}>()

const emit = defineEmits<{
  (e: 'open-offer', offerId: string): void
  (e: 'label-bound', updated: MarketplaceInventoryItemView[]): void
}>()

const bindOpen = ref(false)

const overlay = useQueryOverlay('item')
const route = useRoute()

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

// ── Журнал движения позиции ────────────────────────────────────────────────
const movements = ref<MarketplaceInventoryMovementView[]>([])
const historyLoading = ref(false)

async function loadHistory(): Promise<void> {
  const id = item.value?.id
  if (!id) {
    movements.value = []
    return
  }
  historyLoading.value = true
  try {
    movements.value = await fetchInventoryMovements(String(id))
  } catch {
    movements.value = []
  } finally {
    historyLoading.value = false
  }
}

watch(() => item.value?.id ?? null, () => void loadHistory(), { immediate: true })
// Шаг журнала пишется вместе с изменением позиции — лента склада будит карточку.
useLiveReload(marketLiveTables('warehouse'), () => (isOpen.value ? loadHistory() : undefined))

const MOVEMENT_VIEW: Record<string, { icon: string; type: ActivityEventType }> = {
  RECEIVED: { icon: 'move_to_inbox', type: 'create' },
  RETURNED: { icon: 'assignment_return', type: 'create' },
  PLACED: { icon: 'shelves', type: 'update' },
  LABELED: { icon: 'qr_code', type: 'update' },
  UNLABELED: { icon: 'qr_code_2', type: 'update' },
  RESERVED: { icon: 'bookmark_add', type: 'update' },
  RELEASED: { icon: 'bookmark_remove', type: 'update' },
  RESIZED: { icon: 'straighten', type: 'update' },
  TO_STOCK: { icon: 'inventory', type: 'transfer' },
  TRANSFERRED: { icon: 'local_shipping', type: 'transfer' },
  ISSUED: { icon: 'how_to_reg', type: 'sign' },
  WRITTEN_OFF: { icon: 'delete_sweep', type: 'reject' },
}

type MovementView = MarketplaceInventoryMovementView
const orNone = (value: string | null | undefined): string | undefined => value ?? undefined

/** Пояснение шага: только новое — участок, место, штрих-код, количество, получатель. */
const MOVEMENT_DESCRIPTION: Record<string, (m: MovementView) => string | undefined> = {
  RECEIVED: (m) => orNone(m.branch_name),
  RETURNED: (m) => orNone(m.branch_name),
  TRANSFERRED: (m) => orNone(m.branch_name),
  PLACED: (m) => m.place_label ?? t('marketplace.inventoryItemDrawer.movementUnplaced'),
  LABELED: (m) => orNone(m.barcode_value),
  RESIZED: (m) =>
    item.value && typeof m.quantity === 'number'
      ? inventoryQuantityLabel({ ...item.value, quantity_per_label: m.quantity })
      : undefined,
  ISSUED: (m) =>
    m.recipient_account
      ? t('marketplace.inventoryItemDrawer.movementRecipient', { name: m.recipient_name || m.recipient_account })
      : undefined,
}

const historyEvents = computed<ActivityEvent[]>(() =>
  movements.value.map((m) => {
    const view = MOVEMENT_VIEW[m.kind] ?? { icon: 'history', type: 'system' as ActivityEventType }
    return {
      id: m.id,
      type: view.type,
      icon: view.icon,
      title: t(`marketplace.inventoryItemDrawer.movement.${m.kind}`),
      description: MOVEMENT_DESCRIPTION[m.kind]?.(m),
      actor: m.actor_name || m.actor_account || undefined,
      date: inventoryDateTime(m.at),
    }
  }),
)

const orderOverlay = useQueryOverlay('order')
const coopname = computed(() => String(route.params.coopname ?? ''))

function openOrder(): void {
  if (item.value?.order_id) orderOverlay.open(String(item.value.order_id))
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
