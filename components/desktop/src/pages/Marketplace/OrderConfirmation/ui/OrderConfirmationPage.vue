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

  //- Как страница подтверждения заказа в крупных магазинах: итог и действия
  //- вверху; слева — что заказано; справа — куда приходить (карта, адрес,
  //- режим работы) и путь заказа (замечание владельца 19.11.2026).
  template(v-else)
    header.order-confirm__head
      .order-confirm__head-icon(:class="{ 'order-confirm__head-icon--partial': !result.fully_completed }")
        q-icon(:name="result.fully_completed ? 'check' : 'priority_high'", size="26px")
      .order-confirm__head-text
        .order-confirm__title {{ result.fully_completed ? $t('marketplace.orderConfirmationPage.successTitle') : $t('marketplace.orderConfirmationPage.partialTitle') }}
        .order-confirm__meta(v-if="orders.length") {{ $t('marketplace.orderConfirmationPage.summary', { count: orders.length, amount: formatOrderPrice(total), point: pickupName }) }}
      .order-confirm__head-actions
        BaseButton(variant="secondary", @click="goToCatalog") {{ $t('marketplace.orderConfirmationPage.catalogLink') }}
        BaseButton(variant="primary", @click="goToOrders") {{ $t('marketplace.orderConfirmationPage.myOrdersLink') }}

    //- Не оформленные позиции — сразу под итогом: их оформляют повторно.
    BaseCard(v-if="result.failed_lines.length", :title="$t('marketplace.orderConfirmationPage.failedCount', { count: result.failed_lines.length })")
      .order-confirm__failed-row(v-for="f in result.failed_lines", :key="f.offer_id")
        q-icon(name="warning", color="warning", size="18px")
        div
          .order-confirm__item-name {{ f.product_name || f.offer_id }}
          .order-confirm__item-meta {{ f.reason }}
      .order-confirm__failed-actions(v-if="canRetry")
        BaseButton(variant="secondary", size="sm", :loading="cartStore.checkingOut", @click="onRetry") {{ $t('marketplace.orderConfirmationPage.retryRemainder') }}

    .order-confirm__grid(v-if="orders.length")
      //- Состав заказа: обложка, имущество, количество, сумма; строка открывает заказ.
      BaseCard.order-confirm__items(:title="$t('marketplace.orderConfirmationPage.itemsTitle')")
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
          .order-confirm__item-sum {{ formatOrderPrice(o.totalCost) }}
        .order-confirm__total
          span {{ $t('marketplace.orderConfirmationPage.totalLabel') }}
          span.order-confirm__total-sum {{ formatOrderPrice(total) }}

      .order-confirm__side
        BaseCard(:title="$t('marketplace.orderConfirmationPage.pickupTitle')")
          .order-confirm__map(v-if="pickupCoords")
            MapView(:lat="pickupCoords.lat", :long="pickupCoords.lng", :caption="pickupName")
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
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, NotifyAlert, SuccessAlert } from 'src/shared/api';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';
import { BaseCard, BaseButton, EmptyState } from 'src/shared/ui/base';
import { VerticalStepper } from 'src/shared/ui/domain';
import { Map as MapView } from 'src/shared/ui/Map';
import { toOrderCardModel } from 'src/widgets/Marketplace/OrderCard';
import { formatWorkingHours, useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails';
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
const kuStore = useMarketplaceKUDetailsStore();

const coopname = computed(() => String(route.params.coopname ?? ''));
const result = computed(() => cartStore.lastCheckout);

const orders = computed(() => result.value?.created_orders ?? []);
// Строки состава — та же модель, что у карточки заказа: название, обложка,
// количество в единицах отпуска и сумма для заказчика.
const items = computed(() => orders.value.map((o) => toOrderCardModel(o)));
const total = computed(() => items.value.reduce((sum, o) => sum + o.totalCost, 0));

// Пункт выдачи — участок оформленных заказов: все позиции корзины едут на один.
const pickupBraname = computed(() => orders.value[0]?.delivery_braname ?? cartStore.currentBraname ?? '');
const pickupDetails = computed(() => kuStore.details.find((d) => d.coreBraname === pickupBraname.value) ?? null);
const pickupName = computed(
  () => pickupDetails.value?.name || orders.value[0]?.delivery_point_name || t('marketplace.kuHeaderBar.branchWordLabel'),
);
const pickupAddress = computed(() => pickupDetails.value?.addressFull || orders.value[0]?.delivery_point_address || '');
const pickupHours = computed(() => formatWorkingHours(pickupDetails.value?.workingHours));
const pickupCoords = computed(() => {
  const d = pickupDetails.value;
  return d && d.lat !== null && d.lng !== null ? { lat: Number(d.lat), lng: Number(d.lng) } : null;
});

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
  // Адрес, режим работы и координаты пункта выдачи — из деталей участков.
  if (!kuStore.details.length && coopname.value) {
    void kuStore.load({ coopname: coopname.value, onlyActive: true }).catch(() => undefined);
  }
});
</script>

<style scoped lang="scss">
.order-confirm {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  // ── Итог и действия ──
  &__head {
    display: flex;
    align-items: center;
    gap: var(--p-4, 16px);
    flex-wrap: wrap;
  }

  &__head-icon {
    width: 48px;
    height: 48px;
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

  &__head-text {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: var(--p-fs-h2);
    font-weight: 700;
    color: var(--p-ink);
  }

  &__meta {
    color: var(--p-ink-2);
  }

  &__head-actions {
    display: flex;
    gap: var(--p-2, 8px);
  }

  // ── Состав слева, пункт выдачи и путь справа ──
  &__grid {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
    gap: var(--p-4, 16px);
    align-items: start;

    @media (max-width: 960px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__side {
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__item {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--p-4, 16px);
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
    width: 64px;
    height: 64px;
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

  &__total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
    color: var(--p-ink-2);
  }

  &__total-sum {
    font-size: var(--p-fs-h2);
    font-weight: 700;
    color: var(--p-ink);
  }

  // Карта пункта выдачи — ниже стандартной: рядом стоит состав заказа.
  &__map {
    margin-bottom: var(--p-3, 12px);

    :deep(.ya-map) {
      height: 200px;
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

  &__failed-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--p-2, 8px);
  }
}
</style>
