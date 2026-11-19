<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, NotifyAlert, SuccessAlert } from 'src/shared/api';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';
import { BaseCard, BaseButton, EmptyState } from 'src/shared/ui/base';
import { VerticalStepper } from 'src/shared/ui/domain';
import { OrderCard, toOrderCardModel, type Order as OrderCardModel } from 'src/widgets/Marketplace/OrderCard';
import { formatWorkingHours, useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails';
import { useSystemStore } from 'src/entities/System/model';
import { t, uiLocale } from 'src/shared/i18n';

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

const kuStore = useMarketplaceKUDetailsStore();
const system = useSystemStore();

const orders = computed(() => result.value?.created_orders ?? []);

/** Итог одной строкой: «3 позиции на 1 250 RUB · КУ «Петрушка»». */
const summary = computed(() => {
  const total = orders.value.reduce((sum, o) => sum + Number(o.total_cost_with_fee), 0);
  return t('marketplace.orderConfirmationPage.summary', {
    count: orders.value.length,
    amount: total.toLocaleString(uiLocale()),
    symbol: system.governSymbol,
    point: pickupName.value,
  });
});

// Пункт выдачи — участок оформленных заказов: все позиции корзины едут на один.
const pickupBraname = computed(() => orders.value[0]?.delivery_braname ?? cartStore.currentBraname ?? '');
const pickupDetails = computed(() => kuStore.details.find((d) => d.coreBraname === pickupBraname.value) ?? null);
const pickupName = computed(
  () => pickupDetails.value?.name || orders.value[0]?.delivery_point_name || t('marketplace.kuHeaderBar.branchWordLabel'),
);
const pickupAddress = computed(() => pickupDetails.value?.addressFull || orders.value[0]?.delivery_point_address || '');
const pickupHours = computed(() => formatWorkingHours(pickupDetails.value?.workingHours));

/** Путь заказа до получения: первый шаг пройден, второй — текущий. */
const nextSteps = computed(() => [
  { key: 'placed', label: t('marketplace.orderConfirmationPage.stepPlaced') },
  { key: 'accept', label: t('marketplace.orderConfirmationPage.stepAccept'), description: t('marketplace.orderConfirmationPage.stepAcceptHint') },
  { key: 'delivery', label: t('marketplace.orderConfirmationPage.stepDelivery'), description: t('marketplace.orderConfirmationPage.stepDeliveryHint') },
  { key: 'pickup', label: t('marketplace.orderConfirmationPage.stepPickup'), description: t('marketplace.orderConfirmationPage.stepPickupHint') },
]);

function openDetail(order: OrderCardModel): void {
  void router.push({ name: 'marketplace-order-detail', params: { coopname: coopname.value, orderId: String(order.id) } });
}

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
  // Адрес и режим работы пункта выдачи — из деталей участков.
  if (!kuStore.details.length && coopname.value) {
    void kuStore.load({ coopname: coopname.value, onlyActive: true }).catch(() => undefined);
  }
});
</script>

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

  //- Зоны экрана (замечание владельца 19.11.2026): итог — что оформлено, на
  //- сколько и куда; заказы — строками, как в «Моих заказах»; пункт выдачи —
  //- куда и когда приходить; «Что дальше» — путь заказа до получения.
  .order-confirm__column(v-else)
    BaseCard.order-confirm__hero
      q-icon(
        :name="result.fully_completed ? 'check_circle' : 'info'",
        :color="result.fully_completed ? 'positive' : 'warning'",
        size="48px"
      )
      .order-confirm__title {{ result.fully_completed ? $t('marketplace.orderConfirmationPage.successTitle') : $t('marketplace.orderConfirmationPage.partialTitle') }}
      .order-confirm__summary(v-if="orders.length") {{ summary }}

    //- Не оформленные позиции — сразу под итогом: их оформляют повторно.
    BaseCard.order-confirm__failed(v-if="result.failed_lines.length", :title="$t('marketplace.orderConfirmationPage.failedCount', { count: result.failed_lines.length })")
      .order-confirm__failed-row(v-for="f in result.failed_lines", :key="f.offer_id")
        q-icon(name="warning", color="warning", size="18px")
        .order-confirm__failed-text
          .order-confirm__failed-name {{ f.product_name || f.offer_id }}
          .order-confirm__failed-reason {{ f.reason }}
      .order-confirm__failed-actions(v-if="canRetry")
        BaseButton(variant="secondary", size="sm", :loading="cartStore.checkingOut", @click="onRetry") {{ $t('marketplace.orderConfirmationPage.retryRemainder') }}

    .order-confirm__section(v-if="orders.length")
      .order-confirm__section-title {{ $t('marketplace.orderConfirmationPage.ordersTitle') }}
      .order-confirm__orders
        OrderCard(
          v-for="o in orders",
          :key="o.id",
          :order="toOrderCardModel(o)",
          role="orderer",
          layout="row",
          readonly,
          openable,
          @open="openDetail"
        )

    .order-confirm__pair(v-if="orders.length")
      BaseCard(:title="$t('marketplace.orderConfirmationPage.pickupTitle')")
        .order-confirm__pickup
          .order-confirm__pickup-name {{ pickupName }}
          .order-confirm__pickup-meta(v-if="pickupAddress")
            q-icon(name="location_on", size="16px")
            span {{ pickupAddress }}
          .order-confirm__pickup-meta(v-if="pickupHours.length")
            q-icon(name="schedule", size="16px")
            span
              span(v-for="line in pickupHours", :key="line") {{ line }}
      BaseCard(:title="$t('marketplace.orderConfirmationPage.nextTitle')")
        VerticalStepper(:steps="nextSteps", active-key="accept", :completed="['placed']")

    .order-confirm__actions
      BaseButton(variant="ghost", @click="goToCatalog") {{ $t('marketplace.orderConfirmationPage.catalogLink') }}
      BaseButton(variant="primary", @click="goToOrders") {{ $t('marketplace.orderConfirmationPage.myOrdersLink') }}
</template>

<style scoped lang="scss">
.order-confirm {
  padding: var(--p-6, 24px);

  &__column {
    max-width: 880px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--p-2, 8px);
    padding: var(--p-5, 20px) var(--p-4, 16px);
  }

  &__title {
    font-size: var(--p-fs-h2);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__summary {
    color: var(--p-ink-2);
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__section-title {
    font-size: var(--p-fs-eyebrow);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--p-ink-3);
  }

  &__orders {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  // Пункт выдачи и «Что дальше» — рядом на широком экране, друг под другом на узком.
  &__pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--p-4, 16px);
    align-items: start;

    @media (max-width: 760px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__pickup {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__pickup-name {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__pickup-meta {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);

    > span {
      display: flex;
      flex-direction: column;
    }

    .q-icon {
      color: var(--p-ink-3);
      margin-top: 2px;
    }
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

  &__failed-name {
    color: var(--p-ink);
    font-weight: 500;
  }

  &__failed-reason {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }

  &__failed-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--p-2, 8px);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);
  }
}
</style>
