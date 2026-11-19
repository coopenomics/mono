<template lang="pug">
q-page.order-confirm.mp-role-orderer(role="region", :aria-label="$t('marketplace.orderConfirmationPage.pageAriaLabel')")
  EmptyState(
    v-if="!result",
    :title="$t('marketplace.orderConfirmationPage.emptyTitle')",
    :body="$t('marketplace.orderConfirmationPage.emptyBody')"
  )
    template(#icon)
      q-icon(name="receipt_long", size="48px")
    template(#actions)
      BaseButton(variant="primary", @click="goToOrders") {{ $t('marketplace.orderConfirmationPage.myOrdersLink') }}

  //- Действия — в шапку приложения (канон Teleport, как «Показать QR» в
  //- «Моих заказах»). Итог — в шапке карточки состава, не на голом экране;
  //- справа — путь заказа (замечания владельца 19.11.2026).
  template(v-else)
    Teleport(to="#header-actions-host", defer)
      BaseButton(variant="secondary", size="sm", @click="goToCatalog") {{ $t('marketplace.orderConfirmationPage.catalogLink') }}
      BaseButton(variant="primary", size="sm", @click="goToOrders") {{ $t('marketplace.orderConfirmationPage.myOrdersLink') }}

    //- Не оформленные позиции — сверху: их оформляют повторно.
    BaseCard(v-if="result.failed_lines.length", :title="$t('marketplace.orderConfirmationPage.failedCount', { count: result.failed_lines.length })")
      .order-confirm__failed-row(v-for="f in result.failed_lines", :key="f.offer_id")
        q-icon(name="warning", color="warning", size="18px")
        div
          .order-confirm__item-name {{ f.product_name || f.offer_id }}
          .order-confirm__item-meta {{ f.reason }}
      .order-confirm__failed-actions(v-if="canRetry")
        BaseButton(variant="secondary", size="sm", :loading="cartStore.checkingOut", @click="onRetry") {{ $t('marketplace.orderConfirmationPage.retryRemainder') }}

    .order-confirm__grid(v-if="orders.length")
      //- Итог, состав и суммы: обложка, имущество, количество и стоимость
      //- имущества; строка открывает заказ. Под строками — из чего
      //- складывается сумма, как в корзине.
      BaseCard
        template(#head)
          .order-confirm__head
            .order-confirm__head-icon(:class="{ 'order-confirm__head-icon--partial': !result.fully_completed }")
              q-icon(:name="result.fully_completed ? 'check' : 'priority_high'", size="22px")
            div
              .order-confirm__title {{ result.fully_completed ? $t('marketplace.orderConfirmationPage.successTitle') : $t('marketplace.orderConfirmationPage.partialTitle') }}
              .order-confirm__meta {{ $t('marketplace.orderConfirmationPage.summary', { count: orders.length, point: pickupName }) }}
        .order-confirm__item(
          v-for="o in items",
          :key="o.id",
          role="button",
          tabindex="0",
          @click="openDetail(o.id)",
          @keydown.enter="openDetail(o.id)"
        )
          .order-confirm__thumb
            img(v-if="o.imageUrl", :src="o.imageUrl", :alt="o.title")
            q-icon(v-else, name="inventory_2", size="24px")
          .order-confirm__item-body
            .order-confirm__item-name {{ o.title }}
            .order-confirm__item-meta {{ o.qtyLabel }}
          .order-confirm__item-sum {{ formatOrderPrice(o.cost) }}
        .order-confirm__lines
          .order-confirm__line
            span {{ $t('marketplace.cart.costLabel') }}
            span.order-confirm__line-sum {{ formatOrderPrice(costTotal) }}
          .order-confirm__line(v-if="feeTotal > 0")
            span
              | {{ $t('marketplace.cart.feeLabel') }}
              .order-confirm__line-note {{ $t('marketplace.cart.feeNote') }}
            span.order-confirm__line-sum {{ formatOrderPrice(feeTotal) }}
        .order-confirm__total
          span {{ $t('marketplace.orderConfirmationPage.totalLabel') }}
          span.order-confirm__total-sum {{ formatOrderPrice(costTotal + feeTotal) }}

      BaseCard(:title="$t('marketplace.orderConfirmationPage.nextTitle')")
        VerticalStepper(:steps="nextSteps", active-key="accept", :completed="['placed']")
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, NotifyAlert, SuccessAlert } from 'src/shared/api';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';
import { BaseCard, BaseButton, EmptyState } from 'src/shared/ui/base';
import { VerticalStepper } from 'src/shared/ui/domain';
import { toOrderCardModel } from 'src/widgets/Marketplace/OrderCard';
import { formatOrderPrice } from 'src/shared/lib/marketplace';
import { t } from 'src/shared/i18n';

/**
 * Эпик 16 / Story 16.2: финальный экран после оформления заказа.
 *
 * Отдельная страница (а не карточка в корзине): после оформления корзина
 * пустеет, и показывать итог в «пустой корзине» нелогично. Сюда редиректит
 * корзина после «Оформить заказ»; результат берётся из стора (lastCheckout).
 * Прямой заход/refresh без результата — мягкий редирект в «Мои заказы».
 */
const route = useRoute();
const router = useRouter();
const cartStore = useMarketplaceCartStore();

const coopname = computed(() => String(route.params.coopname ?? ''));
const result = computed(() => cartStore.lastCheckout);

const orders = computed(() => result.value?.created_orders ?? []);
// Строки состава: название, обложка и количество — из модели карточки заказа;
// стоимость имущества и обеспечительная часть — суммы заказа, как их записал
// узел (замечание владельца 19.11.2026: части показываются раздельно, как в
// корзине). Стол суммы не пересчитывает, только складывает по заказам.
const items = computed(() =>
  orders.value.map((o) => {
    // Дата заказа в ответе сервера — скаляр DateTime (строка ISO).
    const card = toOrderCardModel({ ...o, created_at: o.created_at as string });
    return {
      id: String(card.id),
      title: card.title,
      imageUrl: card.imageUrl,
      qtyLabel: card.qtyLabel,
      cost: Number(o.total_cost),
      fee: Number(o.membership_fee ?? 0),
    };
  }),
);
const costTotal = computed(() => items.value.reduce((sum, o) => sum + o.cost, 0));
const feeTotal = computed(() => items.value.reduce((sum, o) => sum + o.fee, 0));

// Пункт выдачи — участок оформленных заказов: все позиции корзины едут на
// один; название содержит сам заказ (поля показа узла).
const pickupName = computed(
  () => orders.value[0]?.delivery_point_name || t('marketplace.kuHeaderBar.branchWordLabel'),
);

/** Путь заказа до получения: первый шаг пройден, второй — текущий. */
const nextSteps = computed(() => [
  { key: 'placed', label: t('marketplace.orderConfirmationPage.stepPlaced') },
  { key: 'accept', label: t('marketplace.orderConfirmationPage.stepAccept') },
  { key: 'delivery', label: t('marketplace.orderConfirmationPage.stepDelivery') },
  { key: 'pickup', label: t('marketplace.orderConfirmationPage.stepPickup') },
]);

// Остаток для повтора есть, только если что-то не прошло И ещё лежит в корзине.
const canRetry = computed(
  () => !!result.value && result.value.failed_lines.length > 0 && cartStore.hasItems,
);

async function onRetry(): Promise<void> {
  if (!result.value) return;
  try {
    const r = await cartStore.checkout(result.value.checkout_id);
    if (r.fully_completed) SuccessAlert(t('marketplace.orderConfirmationPage.remainderPlacedMessage'));
    else NotifyAlert(t('marketplace.orderConfirmationPage.remainderFailedMessage'));
  } catch (e) {
    FailAlert(e);
  }
}

function openDetail(orderId: string): void {
  void router.push({ name: 'marketplace-order-detail', params: { coopname: coopname.value, orderId } });
}

function goToOrders(): void {
  void router.push({ name: 'marketplace-my-orders', params: { coopname: coopname.value } });
}

function goToCatalog(): void {
  void router.push({ name: 'marketplace-catalog', params: { coopname: coopname.value } });
}

onMounted(() => {
  // Нет результата (прямой заход / обновление страницы) — вести в «Мои заказы».
  if (!cartStore.lastCheckout) {
    goToOrders();
    return;
  }
});
</script>

<style scoped lang="scss">
.order-confirm {
  padding: var(--p-6, 24px);

  @media (max-width: 600px) {
    padding: var(--p-4, 16px);
  }

  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  // ── Итог в шапке карточки состава ──
  &__head {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    min-width: 0;
  }

  &__head-icon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: var(--p-r-pill);
    background: var(--p-pos-soft);
    color: var(--p-pos);

    &--partial {
      background: var(--p-warn-soft);
      color: var(--p-warn);
    }
  }

  &__title {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__meta {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }

  // ── Состав слева, путь заказа справа ──
  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
    gap: var(--p-4, 16px);
    align-items: start;

    @media (max-width: 960px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__item {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--p-4, 16px);

    @media (max-width: 600px) {
      grid-template-columns: 48px minmax(0, 1fr) auto;
      gap: var(--p-3, 12px);
    }
    padding: var(--p-3, 12px) 0;
    border-top: 1px solid var(--p-line);
    cursor: pointer;

    &:first-child {
      border-top: none;
      padding-top: 0;
    }

    &:hover .order-confirm__item-name {
      color: var(--p-primary);
    }
  }

  &__thumb {
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--p-r-md);
    background: var(--p-surface-2);
    display: grid;
    place-items: center;
    overflow: hidden;
    color: var(--p-ink-3);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &__item-name {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__item-meta {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }

  &__item-sum {
    font-size: var(--p-fs-h3);
    font-weight: 700;
    color: var(--p-ink);
    white-space: nowrap;
  }

  // Из чего складывается сумма — как в сводке корзины.
  &__lines {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
    padding: var(--p-3, 12px) 0;
    border-top: 1px solid var(--p-line);
  }

  &__line {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--p-3, 12px);
    color: var(--p-ink-2);
  }

  &__line-note {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }

  &__line-sum {
    color: var(--p-ink);
    white-space: nowrap;
  }

  &__total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
    color: var(--p-ink);
    font-weight: 600;
  }

  &__total-sum {
    font-size: var(--p-fs-h2);
    font-weight: 700;
    color: var(--p-ink);
  }

  &__failed-row {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    padding: var(--p-2, 8px) 0;
    border-top: 1px solid var(--p-line);

    &:first-child {
      border-top: none;
    }
  }

  &__failed-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--p-2, 8px);
  }
}
</style>
