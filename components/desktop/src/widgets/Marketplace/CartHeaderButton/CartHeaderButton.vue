<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { BaseButton } from 'src/shared/ui/base';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';

/**
 * Индикатор корзины в шапке стола заказов (Эпик 16). Единый header-виджет для
 * каталога и страницы предложения — телепортируется в `#header-actions-host`,
 * показывает число позиций и ведёт в корзину. Скрыт, пока заказчик не выбрал
 * пункт выдачи (КУ задаёт витрину — заказывать ещё некуда). Вынесен в shared,
 * чтобы кнопка не дублировалась и не пропадала на странице единицы имущества.
 */

const props = defineProps<{ coopname: string }>();

const router = useRouter();
const cartStore = useMarketplaceCartStore();

// Пока КУ не выбран — корзины ещё нет (витрина в режиме просмотра).
const hasKU = computed(() => !!cartStore.currentBraname);

const label = computed(
  () => `Корзина${cartStore.positionsCount ? ` (${cartStore.positionsCount})` : ''}`,
);

function goToCart(): void {
  void router.push({ name: 'marketplace-cart', params: { coopname: props.coopname } });
}
</script>

<template lang="pug">
Teleport(to="#header-actions-host", defer)
  BaseButton(v-if="hasKU", variant="secondary", size="sm", @click="goToCart")
    template(#icon-left)
      q-icon(name="shopping_cart", size="16px")
    | {{ label }}
</template>
