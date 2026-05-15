<script lang="ts" setup>
import { computed } from 'vue';
import type { MarketplaceOfferView } from '../types';

const props = defineProps<{ offer: MarketplaceOfferView }>();
const emit = defineEmits<{ (e: 'select', offer: MarketplaceOfferView): void }>();

const unitLabel = computed(() => {
  switch (props.offer.unit_of_measure) {
    case 'piece':
      return 'шт';
    case 'kg':
      return 'кг';
    case 'liter':
      return 'л';
    case 'pack':
      return 'упак';
    default:
      return props.offer.unit_of_measure;
  }
});

const quantityLabel = computed(() => {
  if (props.offer.unlimited_flag) return 'Без ограничений';
  return `Доступно: ${props.offer.quantity_available} ${unitLabel.value}`;
});

const cycleLabel = computed(() => {
  switch (props.offer.cycle_type) {
    case 'time_based':
      return props.offer.cycle_days
        ? `Циклически (раз в ${props.offer.cycle_days} дн.)`
        : 'Циклически';
    case 'volume_based': {
      const target = props.offer.target_volume ?? 0;
      const accumulated = props.offer.quantity_blocked;
      const waitDays = props.offer.max_wait_days
        ? ` либо через ${props.offer.max_wait_days} дн.`
        : '';
      return `По набору объёма (${accumulated} / ${target}${waitDays})`;
    }
    case 'open_subscription':
      return props.offer.cycle_days
        ? `Подписка (отмена через ${props.offer.cycle_days} дн.)`
        : 'Подписка';
    case 'individual':
      return 'Индивидуально, без отсечки';
    default:
      return props.offer.cycle_type;
  }
});

const warrantyLabel = computed(() =>
  props.offer.warranty_days > 0 ? `Гарантия: ${props.offer.warranty_days} дн.` : null
);

const priceLabel = computed(() => {
  const price = Number(props.offer.price_per_unit);
  return `${price.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽ / ${unitLabel.value}`;
});
</script>

<template lang="pug">
q-card.catalog-offer-card.q-pa-md(
  :aria-label="`Оффер ${offer.product_name}`",
  flat,
  bordered
)
  div.row.items-center.q-mb-sm
    q-chip(square, dense, color="primary", text-color="white") {{ offer.category_id }}
    q-space
    q-chip.text-caption(v-if="warrantyLabel", outline, dense) {{ warrantyLabel }}
  div.text-h6.q-mb-xs.ellipsis-2-lines {{ offer.product_name }}
  div.text-caption.text-grey-7.q-mb-sm Поставщик: {{ offer.supplier_account }}
  div.text-body1.text-weight-medium {{ priceLabel }}
  div.text-caption.q-mb-xs {{ quantityLabel }}
  div.text-caption.text-grey-8 {{ cycleLabel }}
  q-card-actions(align="right")
    q-btn(
      :label="'Заказать'",
      color="primary",
      unelevated,
      :disable="!offer.unlimited_flag && offer.quantity_available <= 0",
      @click="emit('select', offer)"
    )
</template>

<style scoped>
.catalog-offer-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.ellipsis-2-lines {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
