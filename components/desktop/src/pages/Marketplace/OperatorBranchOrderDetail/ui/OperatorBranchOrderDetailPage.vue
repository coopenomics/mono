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

/**
 * Откуда заказ открыли — по пометке `?from=`. Подпись кнопки и запасной
 * маршрут обязаны совпадать с реальным возвратом: из «Экономики участка»
 * кнопка «К заказам участка» уводила туда, где человек не был.
 */
const BACK_TARGETS: Record<string, { label: string; name: string }> = {
  orders: { label: 'К заказам участка', name: 'marketplace-pvz-orders' },
  economy: { label: 'К экономике участка', name: 'marketplace-pvz-economy' },
};

const backTarget = computed<{ label: string; name: string }>(() => {
  const from = BACK_TARGETS[String(route.query.from ?? '')];
  if (from) return from;
  // Без пометки страницу открывает реестр заказов участка — он и остаётся
  // запасным маршрутом при заходе по прямой ссылке.
  return { label: 'К заказам участка', name: 'marketplace-pvz-orders' };
});

// Реальный переход — router.back(): история совпадает с тем, откуда пришли, и
// возвращает страницу в том же состоянии (вкладка, прокрутка, фильтры).
// Прямой заход по ссылке истории не имеет — тогда ведём по запасному маршруту.
function goBack(): void {
  if (window.history.length > 1) router.back();
  else void router.push({ name: backTarget.value.name, params: { coopname: coopname.value } });
}
</script>

<template lang="pug">
q-page.operator-order-detail
  BaseButton.operator-order-detail__back(variant="ghost", size="sm", @click="goBack")
    template(#icon-left)
      q-icon(name="arrow_back", size="16px")
    | {{ backTarget.label }}

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
