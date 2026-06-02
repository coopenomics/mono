<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, SuccessAlert, NotifyAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import {
  useMarketplaceCartStore,
  type IMarketplaceCheckoutResult,
} from 'src/entities/MarketplaceCart';
import { BaseCard, BaseButton, BaseInput, BaseChip, EmptyState } from 'src/shared/ui/base';
import { KUHeaderBar } from 'src/widgets/Marketplace/KUHeaderBar';
import { marketplaceUnitShort } from 'src/shared/lib/consts';

/**
 * Эпик 16 / Story 16.1 + 16.2: страница корзины заказчика и оформление.
 *
 * Корзина — точка оформления: позиции (одна корзина — один КУ), правка
 * количества, удаление, агрегаты. «Оформить заказ» вызывает
 * `marketplaceCheckoutCart` → построчно создаёт заказы под общим checkout_id на
 * текущий КУ. Частичный сбой НЕ откатывает прошедшее: непрошедшие позиции
 * (failed_lines) остаются в корзине, их можно повторить тем же checkout_id.
 */
const route = useRoute();
const router = useRouter();
const system = useSystemStore();
const cartStore = useMarketplaceCartStore();

const coopname = computed(() => String(route.params.coopname ?? ''));

// Результат последнего оформления — показываем сводку (заказы/остаток) до тех
// пор, пока заказчик не уйдёт со страницы или не оформит снова.
const lastResult = ref<IMarketplaceCheckoutResult | null>(null);

const symbol = computed(() => system.governSymbol);

function unitShort(u: string): string {
  return marketplaceUnitShort(u as Parameters<typeof marketplaceUnitShort>[0]);
}

function money(value: string | number): string {
  return Number(value).toLocaleString('ru-RU');
}

async function onQtyChange(offerId: string, value: string | number | null): Promise<void> {
  const q = Number(value);
  if (!Number.isInteger(q) || q < 1) {
    NotifyAlert('Количество должно быть целым числом не меньше 1');
    await cartStore.load();
    return;
  }
  try {
    await cartStore.setQty(offerId, q);
  } catch (e) {
    FailAlert(e);
  }
}

async function onRemove(offerId: string): Promise<void> {
  try {
    await cartStore.removeItem(offerId);
  } catch (e) {
    FailAlert(e);
  }
}

async function onClear(): Promise<void> {
  try {
    await cartStore.clear();
    lastResult.value = null;
  } catch (e) {
    FailAlert(e);
  }
}

// Оформление. `checkoutId` непуст только при повторе непрошедшего остатка —
// тогда позиции лягут в тот же заказ-агрегат.
async function onCheckout(checkoutId?: string): Promise<void> {
  try {
    const result = await cartStore.checkout(checkoutId);
    lastResult.value = result;
    if (result.fully_completed) {
      SuccessAlert('Заказ оформлен');
    } else {
      NotifyAlert(
        'Часть позиций не оформлена — они остались в корзине. Можно повторить оформление остатка.',
      );
    }
  } catch (e) {
    FailAlert(e);
  }
}

function goToOrders(): void {
  void router.push({ name: 'marketplace-my-orders', params: { coopname: coopname.value } });
}

function goToCatalog(): void {
  void router.push({ name: 'marketplace-catalog', params: { coopname: coopname.value } });
}

onMounted(async () => {
  try {
    await cartStore.load();
  } catch (e) {
    FailAlert(e);
  }
});
</script>

<template lang="pug">
q-page.mp-cart.mp-role-orderer(role="region", aria-label="Корзина Стола заказов")
  KUHeaderBar(:coopname="coopname")

  q-inner-loading(:showing="cartStore.loading && !cartStore.cart")
    q-spinner(color="primary", size="2em")

  //- Пустая корзина — ведём в каталог.
  EmptyState(
    v-if="!cartStore.loading && !cartStore.hasItems",
    title="Корзина пуста",
    body="Добавьте товары из каталога — они появятся здесь для оформления одним заказом."
  )
    template(#icon)
      q-icon(name="shopping_cart", size="48px")
    template(#actions)
      BaseButton(variant="primary", @click="goToCatalog") В каталог

  template(v-else-if="cartStore.hasItems")
    BaseCard.mp-cart__items
      .mp-cart__row(v-for="it in cartStore.items", :key="it.offer_id")
        .mp-cart__main
          .mp-cart__name {{ it.product_name }}
          BaseChip.mp-cart__warn(
            v-if="it.available_on_current_ku === false",
            variant="warn",
            size="sm"
          ) Недоступно на текущем пункте выдачи
        .mp-cart__qty
          BaseInput(
            :model-value="it.quantity",
            type="number",
            :label="`Кол-во (${unitShort(it.unit_of_measure)})`",
            @change="(v) => onQtyChange(it.offer_id, v)"
          )
        .mp-cart__price
          .mp-cart__price-unit {{ money(it.price_per_unit) }} {{ symbol }} / {{ unitShort(it.unit_of_measure) }}
          .mp-cart__price-total {{ money(it.line_total) }} {{ symbol }}
        BaseButton(
          variant="ghost",
          icon-only,
          aria-label="Удалить позицию",
          :disabled="cartStore.mutating",
          @click="onRemove(it.offer_id)"
        )
          template(#icon-left)
            q-icon(name="delete_outline")

    BaseCard.mp-cart__summary
      .mp-cart__summary-line
        span Позиций
        span {{ cartStore.positionsCount }}
      .mp-cart__summary-line
        span Всего единиц
        span {{ cartStore.totalQuantity }}
      .mp-cart__summary-line.mp-cart__summary-line--total
        span Итого
        span {{ money(cartStore.totalCost) }} {{ symbol }}
      .mp-cart__summary-actions
        BaseButton(
          variant="ghost",
          :disabled="cartStore.mutating || cartStore.checkingOut",
          @click="onClear"
        ) Очистить
        BaseButton(
          variant="primary",
          :loading="cartStore.checkingOut",
          :disabled="cartStore.mutating",
          @click="() => onCheckout()"
        ) Оформить заказ

  //- Сводка результата последнего оформления (заказы + непрошедший остаток).
  BaseCard.mp-cart__result(v-if="lastResult")
    .mp-cart__result-head
      q-icon(
        :name="lastResult.fully_completed ? 'check_circle' : 'info'",
        :color="lastResult.fully_completed ? 'positive' : 'warning'",
        size="22px"
      )
      .text-subtitle1 {{ lastResult.fully_completed ? 'Заказ оформлен' : 'Заказ оформлен частично' }}
    .mp-cart__result-body
      div Создано заказов на пункт выдачи: {{ lastResult.created_orders.length }}.
      div(v-if="lastResult.failed_lines.length")
        .text-warning Не оформлено позиций: {{ lastResult.failed_lines.length }}
        ul.mp-cart__failed
          li(v-for="f in lastResult.failed_lines", :key="f.offer_id")
            span {{ f.product_name || f.offer_id }} — {{ f.reason }}
    .mp-cart__result-actions
      BaseButton(variant="secondary", @click="goToOrders") К моим заказам
      BaseButton(
        v-if="lastResult.failed_lines.length && cartStore.hasItems",
        variant="primary",
        :loading="cartStore.checkingOut",
        @click="() => onCheckout(lastResult?.checkout_id)"
      ) Повторить оформление остатка
</template>

<style scoped lang="scss">
.mp-cart {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  max-width: 880px;

  &__row {
    display: flex;
    align-items: center;
    gap: var(--p-4, 16px);
    padding: var(--p-3, 12px) 0;

    &:not(:first-child) {
      border-top: 1px solid var(--p-line);
    }
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-weight: 600;
    color: var(--p-ink);
  }

  &__warn {
    margin-top: var(--p-1, 4px);
  }

  &__qty {
    width: 140px;
  }

  &__price {
    width: 180px;
    text-align: right;
  }

  &__price-unit {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }

  &__price-total {
    font-weight: 600;
    color: var(--p-ink);
  }

  &__summary-line {
    display: flex;
    justify-content: space-between;
    padding: var(--p-1, 4px) 0;
    color: var(--p-ink-2);

    &--total {
      font-size: var(--p-fs-h3);
      font-weight: 600;
      color: var(--p-ink);
      border-top: 1px solid var(--p-line);
      margin-top: var(--p-2, 8px);
      padding-top: var(--p-2, 8px);
    }
  }

  &__summary-actions,
  &__result-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--p-2, 8px);
    margin-top: var(--p-4, 16px);
  }

  &__result-head {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
  }

  &__result-body {
    margin-top: var(--p-2, 8px);
    color: var(--p-ink-2);
  }

  &__failed {
    margin: var(--p-2, 8px) 0 0;
    padding-left: var(--p-4, 16px);
  }

  @media (max-width: 768px) {
    &__row {
      flex-wrap: wrap;
    }

    &__price {
      width: auto;
      text-align: left;
    }
  }
}
</style>
