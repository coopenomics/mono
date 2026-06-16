<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { BaseDialog, BaseButton, BaseBadge } from 'src/shared/ui/base';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

/**
 * Выбор имущества со склада кооператива для докладки в выдачу («это не пришло —
 * возьмите вот это» / магазин без предзаказа). Открывается поверх окна выдачи;
 * оператор набирает позиции опубликованного остатка ЭТОГО КУ и добавляет их в
 * тот же акт. Создание заказа из остатка и подпись — на стороне окна выдачи,
 * здесь только набор корзины.
 */

export interface StockPickLine {
  offer_id: string;
  product_name: string;
  price_per_unit: string;
  quantity: number;
}

type CoopStockOffer = {
  id: string;
  product_name: string;
  price_per_unit: string;
  quantity_available: number;
  stock_braname: string | null;
};

const props = defineProps<{
  modelValue: boolean;
  braname: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'add', lines: StockPickLine[]): void;
}>();

const offers = ref<CoopStockOffer[]>([]);
const loading = ref(false);
const quantities = ref<Record<string, number>>({});

const composed = computed(() =>
  offers.value
    .map((o) => ({ offer: o, quantity: quantities.value[o.id] ?? 0 }))
    .filter((l) => l.quantity > 0),
);
const total = computed(() =>
  composed.value
    .reduce((sum, l) => sum + l.quantity * Number.parseFloat(l.offer.price_per_unit), 0)
    .toFixed(4),
);

async function loadOffers(): Promise<void> {
  loading.value = true;
  try {
    const { [Queries.Marketplace.ListCatalog.name]: page } = await client.Query(
      Queries.Marketplace.ListCatalog.query,
      { variables: { input: { delivery_braname: props.braname, page: 1, limit: 200 } } },
    );
    // Докладываем только опубликованный остаток СО СКЛАДА этого КУ.
    offers.value = (page.items as CoopStockOffer[]).filter(
      (o) => o.stock_braname === props.braname && o.quantity_available > 0,
    );
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function bump(offer: CoopStockOffer, delta: number): void {
  const current = quantities.value[offer.id] ?? 0;
  const next = Math.max(0, Math.min(offer.quantity_available, current + delta));
  quantities.value = { ...quantities.value, [offer.id]: next };
}

function confirmAdd(): void {
  emit(
    'add',
    composed.value.map((l) => ({
      offer_id: l.offer.id,
      product_name: l.offer.product_name,
      price_per_unit: l.offer.price_per_unit,
      quantity: l.quantity,
    })),
  );
  quantities.value = {};
  emit('update:modelValue', false);
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      quantities.value = {};
      void loadOffers();
    }
  },
);
</script>

<template lang="pug">
BaseDialog(
  :model-value="modelValue"
  title="Доложить со склада"
  size="md"
  @update:model-value="(v: boolean) => emit('update:modelValue', v)"
)
  .stock-pick
    .stock-pick__intro
      | Опубликованный остаток этого пункта выдачи. Наберите позиции — они
      | добавятся в тот же акт и уйдут пайщику вместе с заказом.

    .stock-pick__empty(v-if="!loading && !offers.length")
      BaseBadge(variant="neutral") Опубликованного остатка на этом пункте нет

    .stock-pick__list(v-else)
      .stock-pick__row(v-for="o in offers", :key="o.id")
        .stock-pick__info
          span.stock-pick__name {{ o.product_name }}
          span.stock-pick__meta
            | {{ formatAsset2Digits(o.price_per_unit) }} ₽ · свободно {{ o.quantity_available }}
        .stock-pick__qty
          BaseButton(
            variant="ghost"
            size="sm"
            :disabled="!(quantities[o.id] ?? 0)"
            @click="bump(o, -1)"
          )
            q-icon(name="remove", size="16px")
          span.stock-pick__count {{ quantities[o.id] ?? 0 }}
          BaseButton(
            variant="ghost"
            size="sm"
            :disabled="(quantities[o.id] ?? 0) >= o.quantity_available"
            @click="bump(o, 1)"
          )
            q-icon(name="add", size="16px")

  template(#footer)
    .stock-pick__foot
      span.stock-pick__total(v-if="composed.length")
        | Выбрано: {{ formatAsset2Digits(total) }} ₽
      q-space
      BaseButton(variant="ghost", @click="emit('update:modelValue', false)") Отмена
      BaseButton(variant="primary", :disabled="!composed.length", @click="confirmAdd")
        template(#icon-left)
          q-icon(name="add_shopping_cart", size="16px")
        | Добавить в выдачу
</template>

<style scoped lang="scss">
.stock-pick {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);

  &__intro {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
    line-height: 1.4;
  }

  &__empty {
    display: flex;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    max-height: 50vh;
    overflow: auto;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-2, 8px);
    padding: var(--p-2, 8px) 0;
    border-bottom: 1px solid var(--p-line);
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  &__name {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__meta {
    font-size: var(--p-fs-meta, 12px);
    color: var(--p-ink-3);
    font-variant-numeric: tabular-nums;
  }

  &__qty {
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
    flex: 0 0 auto;
  }

  &__count {
    min-width: 24px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    color: var(--p-ink);
  }

  &__foot {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    width: 100%;
  }

  &__total {
    font-weight: 600;
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
  }
}
</style>
