<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, SuccessAlert, NotifyAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import {
  useMarketplaceCartStore,
  type IMarketplaceCheckoutResult,
} from 'src/entities/MarketplaceCart';
import { BaseCard, BaseButton, BaseChip, EmptyState } from 'src/shared/ui/base';
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
 *
 * Раскладка — две колонки: слева список позиций (миниатюра, имя, степпер
 * количества, сумма строки), справа липкая карточка-сводка «Ваш заказ» с итогом
 * и кнопкой оформления. Это убирает «комканность» и прыжки поля ввода.
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

// Степпер: меняем количество на ±1 (целое, ≥ 1). Прямой ввод не нужен —
// степпер не прыгает и не требует валидации, как floating-label input.
async function setQty(offerId: string, next: number): Promise<void> {
  if (next < 1 || cartStore.mutating) return;
  try {
    await cartStore.setQty(offerId, next);
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

  .row.q-col-gutter-md(v-else-if="cartStore.hasItems")
    //- Левая колонка: позиции корзины.
    .col-12.col-md-8
      BaseCard.mp-cart__items
        .mp-cart__line(v-for="it in cartStore.items", :key="it.offer_id")
          .mp-cart__thumb
            q-img(v-if="it.image_url", :src="it.image_url", ratio="1")
            .mp-cart__thumb-empty(v-else)
              q-icon(name="image", size="22px")
          .mp-cart__info
            .mp-cart__name {{ it.product_name }}
            .mp-cart__unit {{ money(it.price_per_unit) }} {{ symbol }} / {{ unitShort(it.unit_of_measure) }}
            BaseChip.mp-cart__warn(
              v-if="it.available_on_current_ku === false",
              variant="warn",
              size="sm"
            ) Недоступно на текущем пункте выдачи
          .mp-cart__qty
            BaseButton(
              variant="ghost",
              icon-only,
              size="sm",
              aria-label="Уменьшить количество",
              :disabled="it.quantity <= 1 || cartStore.mutating",
              @click="setQty(it.offer_id, it.quantity - 1)"
            )
              template(#icon-left)
                q-icon(name="remove")
            .mp-cart__qty-val
              span.mp-cart__qty-num {{ it.quantity }}
              span.mp-cart__qty-unit {{ unitShort(it.unit_of_measure) }}
            BaseButton(
              variant="ghost",
              icon-only,
              size="sm",
              aria-label="Увеличить количество",
              :disabled="cartStore.mutating",
              @click="setQty(it.offer_id, it.quantity + 1)"
            )
              template(#icon-left)
                q-icon(name="add")
          .mp-cart__sum {{ money(it.line_total) }} {{ symbol }}
          BaseButton.mp-cart__del(
            variant="ghost",
            icon-only,
            size="sm",
            aria-label="Удалить позицию",
            :disabled="cartStore.mutating",
            @click="onRemove(it.offer_id)"
          )
            template(#icon-left)
              q-icon(name="delete_outline")

    //- Правая колонка: липкая сводка заказа.
    .col-12.col-md-4
      BaseCard.mp-cart__summary
        .mp-cart__summary-title Ваш заказ
        .mp-cart__summary-line
          span Позиций
          span.mp-cart__summary-val {{ cartStore.positionsCount }}
        .mp-cart__summary-line
          span Всего единиц
          span.mp-cart__summary-val {{ cartStore.totalQuantity }}
        .mp-cart__summary-total
          span Итого
          span {{ money(cartStore.totalCost) }} {{ symbol }}
        BaseButton.mp-cart__checkout(
          variant="primary",
          :loading="cartStore.checkingOut",
          :disabled="cartStore.mutating",
          @click="() => onCheckout()"
        ) Оформить заказ
        BaseButton.mp-cart__clear(
          variant="ghost",
          size="sm",
          :disabled="cartStore.mutating || cartStore.checkingOut",
          @click="onClear"
        ) Очистить корзину

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

  // ── Позиции ─────────────────────────────────────────────────────────
  &__line {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    padding: var(--p-3, 12px) 0;

    &:not(:first-child) {
      border-top: 1px solid var(--p-line);
    }
  }

  &__thumb {
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    border-radius: var(--p-r-md, 12px);
    overflow: hidden;
    background: var(--p-surface-2);
  }

  &__thumb-empty {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    color: var(--p-ink-3);
  }

  &__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__name {
    font-weight: 600;
    color: var(--p-ink);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__unit {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }

  &__warn {
    align-self: flex-start;
    margin-top: var(--p-1, 4px);
  }

  // Степпер количества: фиксированной ширины, не прыгает.
  &__qty {
    display: flex;
    align-items: center;
    gap: var(--p-1, 4px);
    flex-shrink: 0;
  }

  &__qty-val {
    min-width: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
  }

  &__qty-num {
    font-weight: 600;
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
  }

  &__qty-unit {
    font-size: var(--p-fs-meta);
    color: var(--p-ink-3);
  }

  &__sum {
    width: 110px;
    text-align: right;
    font-weight: 600;
    color: var(--p-ink);
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  &__del {
    flex-shrink: 0;
  }

  // ── Сводка (правая колонка) ─────────────────────────────────────────
  &__summary {
    position: sticky;
    top: var(--p-6, 24px);
  }

  &__summary-title {
    font-size: var(--p-fs-h2);
    font-weight: 600;
    color: var(--p-ink);
    margin-bottom: var(--p-3, 12px);
  }

  &__summary-line {
    display: flex;
    justify-content: space-between;
    padding: var(--p-1, 4px) 0;
    color: var(--p-ink-2);
  }

  &__summary-val {
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
  }

  &__summary-total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: var(--p-2, 8px);
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
    font-size: var(--p-fs-h2);
    font-weight: 700;
    color: var(--p-ink);

    span:last-child {
      font-variant-numeric: tabular-nums;
    }
  }

  &__checkout {
    width: 100%;
    margin-top: var(--p-4, 16px);
  }

  &__clear {
    width: 100%;
    margin-top: var(--p-2, 8px);
  }

  // ── Результат оформления ────────────────────────────────────────────
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

  &__result-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--p-2, 8px);
    margin-top: var(--p-4, 16px);
  }

  @media (max-width: 768px) {
    &__line {
      flex-wrap: wrap;
    }

    &__sum {
      width: auto;
      text-align: left;
    }

    &__summary {
      position: static;
    }
  }
}
</style>
