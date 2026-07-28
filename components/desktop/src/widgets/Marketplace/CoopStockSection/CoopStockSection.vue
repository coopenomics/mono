<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { date } from 'quasar';
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseInput } from 'src/shared/ui/base';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { floorDecimalString } from 'src/shared/lib/utils/floorDecimalString';
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import {
  listStock,
  publishStock,
  unpublishStock,
  type MarketplaceInventoryItemView,
} from 'src/pages/Marketplace/OperatorOwnWarehouse/api';

/**
 * Остаток кооператива на складе КУ (requirement 76): обезличенные позиции,
 * оставшиеся после недовыдач и отказов. Оператор публикует их в каталог
 * предложением от кооператива (цена прибытия или уценка) и снимает с витрины.
 * Зарезервированные под заказы со склада позиции показываются, но не трогаются.
 */

const items = ref<MarketplaceInventoryItemView[]>([]);
const loading = ref(false);
const selected = ref<Set<string>>(new Set());

const publishDialogOpen = ref(false);
const publishPrice = ref('');
// Скоропорт с докладки обычно не возвращают — 0 дней безопасный дефолт;
// оператор ПВЗ переопределяет на своё усмотрение перед публикацией.
const publishWarrantyDays = ref('0');
const publishing = ref(false);

async function reload(): Promise<void> {
  loading.value = true;
  try {
    items.value = await listStock();
    // Снятые/ушедшие позиции выкидываем из выбора.
    const ids = new Set(items.value.map((i) => i.id));
    selected.value = new Set([...selected.value].filter((id) => ids.has(id)));
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => void reload());
useMarketplaceRealtime(
  {
    MarketplaceStockProposalResolvedEvent: () => void reload(),
    MarketplaceOfferStockChangedEvent: () => void reload(),
  },
  { onResync: () => void reload() },
);

type StockState = 'free' | 'published' | 'reserved';
function stateOf(i: MarketplaceInventoryItemView): StockState {
  if (i.reserved_order_id) return 'reserved';
  if (i.published_offer_id) return 'published';
  return 'free';
}
const STATE_BADGE: Record<StockState, { label: string; variant: 'neutral' | 'pos' | 'info' }> = {
  free: { label: 'Свободна', variant: 'neutral' },
  published: { label: 'На витрине', variant: 'pos' },
  reserved: { label: 'Зарезервирована', variant: 'info' },
};

const selectedItems = computed(() => items.value.filter((i) => selected.value.has(i.id)));
const selectedFree = computed(() => selectedItems.value.filter((i) => stateOf(i) === 'free'));
const selectedPublished = computed(() =>
  selectedItems.value.filter((i) => stateOf(i) === 'published'),
);

function toggle(id: string): void {
  const next = new Set(selected.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selected.value = next;
}

function quantityLabel(i: MarketplaceInventoryItemView): string {
  const saleUnit = marketplaceOrderSaleUnit(i.quantity_per_label, i.unit_of_measure, i.package_size);
  return `${saleUnit.units}×${saleUnit.unitLabel}`;
}

function expiryLabel(i: MarketplaceInventoryItemView): string {
  return i.expiry_date ? date.formatDate(i.expiry_date as unknown as string, 'DD.MM.YYYY') : '—';
}

function openPublishDialog(): void {
  // Префилл цены — цена прибытия первой выбранной позиции (база уценки).
  // Урезаем до 2 знаков (asset на цепи — precision 4, «100.0000» выглядело
  // неотформатированным полем ввода); floorDecimalString — truncate, не
  // round, и отдаёт точку, а не запятую — годится и на отправку в мутацию.
  const arrivalPrice = selectedFree.value.find((i) => i.arrival_price)?.arrival_price;
  publishPrice.value = arrivalPrice ? floorDecimalString(arrivalPrice, 2) : '';
  publishWarrantyDays.value = '0';
  publishDialogOpen.value = true;
}

async function confirmPublish(): Promise<void> {
  publishing.value = true;
  try {
    await publishStock({
      inventory_ids: selectedFree.value.map((i) => i.id),
      price_per_unit: publishPrice.value ? publishPrice.value : null,
      warranty_days: publishWarrantyDays.value !== '' ? Number(publishWarrantyDays.value) : null,
    });
    SuccessAlert('Остаток опубликован в каталоге предложением от кооператива.');
    publishDialogOpen.value = false;
    selected.value = new Set();
    await reload();
  } catch (e) {
    FailAlert(e);
  } finally {
    publishing.value = false;
  }
}

async function unpublishSelected(): Promise<void> {
  try {
    const affected = await unpublishStock({
      inventory_ids: selectedPublished.value.map((i) => i.id),
    });
    SuccessAlert(`Снято с витрины позиций: ${affected}.`);
    selected.value = new Set();
    await reload();
  } catch (e) {
    FailAlert(e);
  }
}
</script>

<template lang="pug">
BaseCard.coop-stock(v-if='loading || items.length')
  template(#head)
    .coop-stock__head
      q-icon(name='warehouse', size='22px')
      span.coop-stock__title Остаток кооператива
      span.coop-stock__hint осталось после недовыдач и отказов — можно заново предложить пайщикам
  template(#actions)
    .coop-stock__actions
      BaseButton(
        v-if='selectedPublished.length',
        variant='ghost',
        size='sm',
        @click='unpublishSelected'
      ) Снять с витрины ({{ selectedPublished.length }})
      BaseButton(
        v-if='selectedFree.length',
        variant='primary',
        size='sm',
        @click='openPublishDialog'
      ) Опубликовать ({{ selectedFree.length }})

  .table-wrap
    .table-scroll
      table.table
        thead
          tr
            th
            th Товар
            th.num Кол-во
            th.num Цена прибытия
            th Годен до
            th Состояние
        tbody
          tr(v-for='i in items', :key='i.id')
            td
              q-checkbox(
                :model-value='selected.has(i.id)',
                :disable='stateOf(i) === "reserved"',
                dense,
                @update:model-value='toggle(i.id)'
              )
            td {{ i.product_name_snapshot }}
            td.num {{ quantityLabel(i) }}
            td.num {{ i.arrival_price ? formatAsset2Digits(i.arrival_price) + ' ₽' : '—' }}
            td {{ expiryLabel(i) }}
            td
              BaseBadge(:variant='STATE_BADGE[stateOf(i)].variant', size='sm')
                | {{ STATE_BADGE[stateOf(i)].label }}

BaseDialog(
  v-model='publishDialogOpen',
  title='Публикация остатка в каталог'
)
  .coop-stock__publish
    p.coop-stock__publish-note
      | Выбранные позиции станут предложением от кооператива с мгновенной
      | выдачей со склада. База цены — цена прибытия; укажите меньшую,
      | чтобы продать с уценкой.
    BaseInput(
      v-model='publishPrice',
      label='Цена за единицу, ₽',
      type='number',
      hint='Пусто — по цене прибытия каждой позиции'
    )
    BaseInput(
      v-model='publishWarrantyDays',
      label='Срок гарантийного возврата, дней',
      type='number',
      hint='0 — вернуть нельзя (обычно для скоропорта)'
    )
    .coop-stock__publish-actions
      BaseButton(variant='ghost', @click='publishDialogOpen = false') Отменить
      BaseButton(variant='primary', :loading='publishing', @click='confirmPublish')
        | Опубликовать {{ selectedFree.length }} поз.
</template>

<style scoped lang="scss">
.coop-stock {
  &__head {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    min-width: 0;

    .q-icon {
      color: var(--p-primary);
    }
  }

  &__title {
    font-weight: 600;
    color: var(--p-ink);
  }

  &__hint {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
  }

  &__actions {
    display: flex;
    gap: var(--p-2, 8px);
  }

  &__publish {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);

    &-note {
      margin: 0;
      font-size: var(--p-fs-body-sm, 13px);
      color: var(--p-ink-2);
    }

    &-actions {
      display: flex;
      justify-content: space-between;
    }
  }
}
</style>
