<script lang="ts" setup>
/**
 * Страница одного заказа на столе ПВЗ. Открывается кликом по строке реестра
 * заказов участка и ссылкой из движения в «Экономике участка». Содержимое —
 * общий виджет OrderRegistryDetail (тот же, что на столе администратора);
 * переход на карточку предложения скрыт — у оператора нет права её смотреть.
 */
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { BaseButton } from 'src/shared/ui/base';
import { OrderRegistryDetail } from 'src/widgets/Marketplace/OrderRegistryDetail';

const route = useRoute();
const router = useRouter();

const coopname = computed(() => String(route.params.coopname ?? ''));
const orderId = computed(() => String(route.params.orderId ?? ''));

function goBack(): void {
  void router.push({ name: 'marketplace-pvz-orders', params: { coopname: coopname.value } });
}
</script>

<template lang="pug">
q-page.operator-order-detail
  BaseButton.operator-order-detail__back(variant="ghost", size="sm", @click="goBack")
    template(#icon-left)
      q-icon(name="arrow_back", size="16px")
    | К заказам участка

  OrderRegistryDetail(
    :coopname="coopname",
    :order-id="orderId",
    :show-offer-link="false"
  )
</template>

<style scoped lang="scss">
.operator-order-detail {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__back {
    align-self: flex-start;
  }
}

@media (max-width: 768px) {
  .operator-order-detail {
    padding: var(--p-4, 16px);
  }
}
</style>
