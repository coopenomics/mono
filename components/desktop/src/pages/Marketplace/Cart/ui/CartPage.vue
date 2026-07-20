<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { debounce } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, NotifyAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import {
  useMarketplaceCartStore,
  type IMarketplaceCartItem,
} from 'src/entities/MarketplaceCart';
import { BaseCard, BaseButton, BaseChip, EmptyState } from 'src/shared/ui/base';
import { KUHeaderBar } from 'src/widgets/Marketplace/KUHeaderBar';
import { marketplaceUnitShort } from 'src/shared/lib/consts';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';

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

const symbol = computed(() => system.governSymbol);

function unitShort(u: string): string {
  return marketplaceUnitShort(u as Parameters<typeof marketplaceUnitShort>[0]);
}

function money(value: string | number): string {
  return Number(value).toLocaleString('ru-RU');
}

// Низкоуровневый коммит количества (целое ≥ 1). Кламп делает changeQty.
async function setQty(offerId: string, next: number): Promise<void> {
  if (next < 1 || cartStore.mutating) return;
  try {
    await cartStore.setQty(offerId, next);
  } catch (e) {
    FailAlert(e);
  }
}

// Максимум на предложении (null = без ограничения).
function maxOf(item: IMarketplaceCartItem): number | null {
  return item.max_available ?? null;
}

function atMax(item: IMarketplaceCartItem): boolean {
  const max = maxOf(item);
  return max != null && item.quantity >= max;
}

// Кламп к [1, max] и коммит, если значение изменилось. Возвращает итог.
function changeQty(item: IMarketplaceCartItem, next: number): number {
  let n = Math.floor(next);
  if (!Number.isFinite(n) || n < 1) n = 1;
  const max = maxOf(item);
  if (max != null && n > max) {
    n = max;
    NotifyAlert(`Доступно не больше ${max} ${unitShort(item.unit_of_measure ?? '')}`);
  }
  if (n !== item.quantity) void setQty(item.offer_id, n);
  return n;
}

// Прямой ввод в поле количества: парсим, клампим, ПЕРЕЗАПИСЫВАЕМ значение в DOM
// (чтобы мусор/превышение сразу заменились на корректное число — без скачка
// вёрстки, поле остаётся частью степпера).
function onQtyInput(item: IMarketplaceCartItem, ev: Event): void {
  const el = ev.target as HTMLInputElement;
  const parsed = Number(el.value);
  const next = Number.isFinite(parsed) && parsed >= 1 ? parsed : item.quantity;
  el.value = String(changeQty(item, next));
}

// Enter — снять фокус (коммит уже идёт по @change). Каст в .ts, не в template:
// Vue парсит template-выражения как JS, `as` там ломает boot (SyntaxError).
function blurOnEnter(ev: Event): void {
  (ev.target as HTMLInputElement).blur();
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
  } catch (e) {
    FailAlert(e);
  }
}

// Оформление → отдельная страница подтверждения (итог не показываем в корзине,
// которая после оформления пустеет). Результат уезжает в стор (lastCheckout),
// confirmation-страница его читает.
async function onCheckout(): Promise<void> {
  try {
    await cartStore.checkout();
    void router.push({
      name: 'marketplace-order-confirmation',
      params: { coopname: coopname.value },
    });
  } catch (e) {
    FailAlert(e);
  }
}

function goToCatalog(): void {
  void router.push({ name: 'marketplace-catalog', params: { coopname: coopname.value } });
}

// Клик по позиции ведёт на полную карточку предложения (как из каталога).
// `from=cart` — чтобы кнопка «назад» на карточке называлась «В корзину».
function goToDetail(offerId: string): void {
  void router.push({
    name: 'marketplace-offer-detail',
    params: { coopname: coopname.value, offerId },
    query: { from: 'cart' },
  });
}

// Realtime: остаток позиции из корзины изменился (другие пайщики выкупают
// предложение) — перечитываем корзину, чтобы оформление не упёрлось в
// устаревшее количество. Реагируем только на свои offer_id.
const reloadLive = debounce(() => {
  if (cartStore.loading) return;
  void cartStore.load();
}, 400);
useMarketplaceRealtime(
  {
    MarketplaceOfferStockChangedEvent: (event) => {
      if (cartStore.items.some((it) => it.offer_id === event.offer_id)) reloadLive();
    },
  },
  { onResync: () => reloadLive() },
);

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

  //- Канон: первичная загрузка — скелетон-строки позиций, не перекрывающий спиннер.
  BaseCard.mp-cart__skel(v-if="cartStore.loading && !cartStore.cart")
    .mp-cart__skel-line(v-for="n in 4", :key="`skel-${n}`")
      .skel.mp-cart__skel-thumb
      .mp-cart__skel-text
        .skel.skel--title.mp-cart__skel-l1
        .skel.skel--text.mp-cart__skel-l2
      .skel.skel--num.mp-cart__skel-sum

  //- Пустая корзина — ведём в каталог.
  EmptyState(
    v-else-if="!cartStore.hasItems",
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
          .mp-cart__thumb(role="button", tabindex="0", @click="goToDetail(it.offer_id)", @keyup.enter="goToDetail(it.offer_id)")
            q-img(v-if="it.image_url", :src="it.image_url", ratio="1")
            .mp-cart__thumb-empty(v-else)
              q-icon(name="image", size="22px")
          .mp-cart__info
            .mp-cart__name(role="button", tabindex="0", @click="goToDetail(it.offer_id)", @keyup.enter="goToDetail(it.offer_id)") {{ it.product_name }}
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
              @click="changeQty(it, it.quantity - 1)"
            )
              template(#icon-left)
                q-icon(name="remove")
            .mp-cart__qty-val
              //- Inline-ввод: не стандартный outlined-input, а часть степпера —
              //- правка цифр прямо в числе, кламп к остатку на предложении.
              input.mp-cart__qty-input(
                type="text",
                inputmode="numeric",
                :value="it.quantity",
                :disabled="cartStore.mutating",
                aria-label="Количество",
                @change="onQtyInput(it, $event)",
                @keyup.enter="blurOnEnter"
              )
              span.mp-cart__qty-unit {{ unitShort(it.unit_of_measure) }}
            BaseButton(
              variant="ghost",
              icon-only,
              size="sm",
              aria-label="Увеличить количество",
              :disabled="cartStore.mutating || atMax(it)",
              @click="changeQty(it, it.quantity + 1)"
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
          @click="onCheckout"
        ) Оформить заказ
        BaseButton.mp-cart__clear(
          variant="ghost",
          size="sm",
          :disabled="cartStore.mutating || cartStore.checkingOut",
          @click="onClear"
        ) Очистить корзину
</template>

<style scoped lang="scss">
.mp-cart {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  // ── Скелетон первичной загрузки (повторяет форму строки позиции) ──────
  &__skel-line {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    padding: var(--p-3, 12px) 0;

    &:not(:first-child) {
      border-top: 1px solid var(--p-line);
    }
  }
  &__skel-thumb {
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    border-radius: var(--p-r-md, 12px);
  }
  &__skel-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }
  &__skel-l1 {
    width: 60%;
  }
  &__skel-l2 {
    width: 35%;
  }
  &__skel-sum {
    width: 90px;
    flex-shrink: 0;
  }

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
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--p-primary);
      outline-offset: 2px;
    }
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
    cursor: pointer;
    width: fit-content;

    &:hover {
      color: var(--p-primary);
    }

    &:focus-visible {
      outline: 2px solid var(--p-primary);
      outline-offset: 2px;
      border-radius: var(--p-r-sm, 8px);
    }
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

  // Поле прямого ввода — без рамок/фона, выглядит как число степпера, но
  // редактируемое. Так не «прыгает» и не ломает строку, как outlined-input.
  &__qty-input {
    width: 48px;
    border: none;
    background: transparent;
    text-align: center;
    font: inherit;
    font-weight: 600;
    color: var(--p-ink);
    font-variant-numeric: tabular-nums;
    padding: 0;
    -moz-appearance: textfield;

    &:focus {
      outline: none;
      color: var(--p-primary);
    }

    &:disabled {
      color: var(--p-ink-2);
    }
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
