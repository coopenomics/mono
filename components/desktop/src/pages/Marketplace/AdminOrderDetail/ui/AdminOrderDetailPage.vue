<script lang="ts" setup>
/**
 * Страница одного заказа на столе администратора. Открывается кликом по
 * строке реестра всех заказов кооператива и ссылкой из движений кошелька.
 * Содержимое — общий виджет OrderRegistryDetail (тот же, что на столе ПВЗ);
 * здесь только возврат к своему реестру и переход на карточку предложения.
 */
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { BaseButton } from 'src/shared/ui/base';
import { OrderRegistryDetail } from 'src/widgets/Marketplace/OrderRegistryDetail';

const route = useRoute();
const router = useRouter();
const { info } = useSystemStore();

const orderId = computed(() => String(route.params.orderId ?? ''));

function goBack(): void {
  void router.push({ name: 'marketplace-admin-orders', params: { coopname: info.coopname } });
}

// Карточка предложения (имущества) на столе администратора — readonly,
// без перехода в каталог/на стол заказчика.
function goToOffer(offerId: string): void {
  void router.push({
    name: 'marketplace-admin-offer-detail',
    params: { coopname: info.coopname, offerId },
    query: { from: 'orders' },
  });
}
</script>

<template lang="pug">
q-page.admin-order-detail
  BaseButton.admin-order-detail__back(variant="ghost", size="sm", @click="goBack")
    template(#icon-left)
      q-icon(name="arrow_back", size="16px")
    | К реестру заказов

  OrderRegistryDetail(
    :coopname="info.coopname",
    :order-id="orderId",
    @offer-click="goToOffer"
  )
</template>

<style scoped lang="scss">
.admin-order-detail {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__back {
    align-self: flex-start;
  }
}

@media (max-width: 768px) {
  .admin-order-detail {
    padding: var(--p-4, 16px);
  }
}
</style>
