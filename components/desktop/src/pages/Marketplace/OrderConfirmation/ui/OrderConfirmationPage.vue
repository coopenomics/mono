<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, NotifyAlert, SuccessAlert } from 'src/shared/api';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';
import { BaseCard, BaseButton, EmptyState } from 'src/shared/ui/base';
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
  if (!cartStore.lastCheckout) goToOrders();
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

  template(v-else)
    BaseCard.order-confirm__card
      .order-confirm__hero
        q-icon(
          :name="result.fully_completed ? 'check_circle' : 'info'",
          :color="result.fully_completed ? 'positive' : 'warning'",
          size="56px"
        )
        .order-confirm__title {{ result.fully_completed ? $t('marketplace.orderConfirmationPage.successTitle') : $t('marketplace.orderConfirmationPage.partialTitle') }}
        .order-confirm__subtitle {{ $t('marketplace.orderConfirmationPage.createdCount', { count: result.created_orders.length }) }}

      template(v-if="result.failed_lines.length")
        q-separator.order-confirm__sep
        .order-confirm__failed-head
          q-icon(name="warning", color="warning", size="18px")
          span {{ $t('marketplace.orderConfirmationPage.failedCount', { count: result.failed_lines.length }) }}
        ul.order-confirm__failed
          li(v-for="f in result.failed_lines", :key="f.offer_id")
            span.order-confirm__failed-name {{ f.product_name || f.offer_id }}
            span.order-confirm__failed-reason {{ f.reason }}

      .order-confirm__actions
        BaseButton(
          v-if="canRetry",
          variant="secondary",
          :loading="cartStore.checkingOut",
          @click="onRetry"
        ) {{ $t('marketplace.orderConfirmationPage.retryRemainder') }}
        BaseButton(variant="ghost", @click="goToCatalog") {{ $t('marketplace.orderConfirmationPage.catalogLink') }}
        BaseButton(variant="primary", @click="goToOrders") {{ $t('marketplace.orderConfirmationPage.myOrdersLink') }}
</template>

<style scoped lang="scss">
.order-confirm {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__card {
    max-width: 640px;
    margin: 0 auto;
    width: 100%;
  }

  &__hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--p-2, 8px);
    padding: var(--p-4, 16px) 0;
  }

  &__title {
    font-size: var(--p-fs-h2);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__subtitle {
    color: var(--p-ink-2);
  }

  &__sep {
    background: var(--p-line);
    margin: var(--p-3, 12px) 0;
  }

  &__failed-head {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    color: var(--p-ink);
    font-weight: 600;
  }

  &__failed {
    list-style: none;
    margin: var(--p-2, 8px) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__failed li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--p-2, 8px) var(--p-3, 12px);
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-sm, 8px);
  }

  &__failed-name {
    color: var(--p-ink);
    font-weight: 500;
  }

  &__failed-reason {
    font-size: var(--p-fs-body-sm);
    color: var(--p-warn);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);
    margin-top: var(--p-4, 16px);
  }
}
</style>
