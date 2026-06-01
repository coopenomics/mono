<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Dialog, Loading } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard } from 'src/shared/ui/base';
import { RefreshButton } from 'src/widgets/Marketplace/RefreshButton';
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { cancelOrder, fetchOrder } from '../../MyOrders/api';
import type { MarketplaceOrderView } from '../../MyOrders/types';
import OrdererFinalizeIssuanceDialog from '../../MyOrders/ui/OrdererFinalizeIssuanceDialog.vue';

/**
 * Детальная страница заказа заказчика. Открывается кликом по карточке на
 * «Моих заказах» (route `marketplace-order-detail`). Показывает полный состав
 * заказа, ПВЗ, хронологию этапов и факт выдачи, а управление (отмена до
 * акцепта, «Подписать и получить» на этапе выдачи) — здесь же, дублируя
 * действия карточки. Источник — `marketplaceGetOrder`.
 */

const POLL_INTERVAL_MS = 15_000;

const route = useRoute();
const router = useRouter();
const coopname = computed(() => String(route.params.coopname ?? ''));
const orderId = computed(() => String(route.params.orderId ?? ''));

const order = ref<MarketplaceOrderView | null>(null);
const loading = ref(false);

const finalizeDialogOpen = ref(false);

const status = computed(() => (order.value ? orderStatusDisplay(order.value.status) : null));
const unitShort = computed(() => marketplaceUnitShort(order.value?.unit_of_measure));
const cancellable = computed(() => order.value?.status === 'ACTIVE');
const receivable = computed(() => order.value?.status === 'READY_TO_RECEIVE');

const pvzName = computed(() => order.value?.delivery_point_name || order.value?.delivery_braname || '');
const pvzAddress = computed(() => order.value?.delivery_point_address || '');

// Хронология этапов — только заполненные отметки времени, в порядке движения.
const timeline = computed<Array<{ label: string; value: string }>>(() => {
  const o = order.value;
  if (!o) return [];
  const rows: Array<{ label: string; value: unknown }> = [
    { label: 'Оформлен', value: o.created_at },
    { label: 'Принят поставщиком', value: o.accepted_at },
    { label: 'Выдача открыта', value: o.chairman_signed_at },
    { label: 'Получен', value: o.received_at },
    { label: 'Отменён', value: o.cancelled_at },
    { label: 'Гарантия до', value: o.warranty_until },
  ];
  return rows
    .filter((r) => r.value !== null && r.value !== undefined && r.value !== '')
    .map((r) => ({ label: r.label, value: formatDate(r.value) }));
});

// Факт выдачи появляется, когда оператор открыл выдачу.
const issuanceFact = computed(() => order.value?.issuance_fact ?? null);

function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('ru-RU');
}

function formatPrice(value: string | null | undefined): string {
  return `${formatAsset2Digits(String(value ?? '0'))} ₽`;
}

async function load(): Promise<void> {
  if (!orderId.value) return;
  loading.value = true;
  try {
    order.value = await fetchOrder(orderId.value);
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить заказ');
  } finally {
    loading.value = false;
  }
}

function goBack(): void {
  void router.push({ name: 'marketplace-my-orders', params: { coopname: coopname.value } });
}

function confirmCancel(): void {
  const o = order.value;
  if (!o) return;
  Dialog.create({
    title: 'Отменить заказ?',
    message: `Заказ № ${o.id.slice(0, 8)} (${o.quantity} ед., ${o.total_cost} ₽) будет отменён. Средства разблокируются на кошельке Стола заказов.`,
    cancel: { label: 'Не отменять', flat: true },
    ok: { label: 'Отменить заказ', color: 'negative', unelevated: true },
    persistent: true,
  }).onOk(async () => {
    Loading.show({ message: 'Отменяю заказ…' });
    try {
      const result = await cancelOrder(o.id);
      SuccessAlert(`Заказ отменён. Средства разблокированы (tx ${result.tx_hash.slice(0, 8)}).`);
      await load();
    } catch (e) {
      FailAlert(e);
    } finally {
      Loading.hide();
    }
  });
}

function onFinalized(): void {
  void load();
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  void load();
  pollTimer = setInterval(() => {
    if (!loading.value) void load();
  }, POLL_INTERVAL_MS);
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template lang="pug">
q-page.order-detail(role="region", aria-label="Заказ")
  Teleport(to="#header-actions-host", defer)
    RefreshButton(:loading="loading", @refresh="load")

  .order-detail__col
    BaseButton.order-detail__back(variant="ghost", size="sm", @click="goBack")
      template(#icon-left)
        q-icon(name="arrow_back", size="16px")
      | К моим заказам

    q-inner-loading(:showing="loading && !order")
      q-spinner(color="primary", size="2em")

    template(v-if="order")
      BaseCard.order-detail__card
        template(#head)
          .order-detail__head
            .order-detail__head-row
              .t-h2.order-detail__title {{ order.product_name || 'Товар по предложению' }}
              BaseBadge(v-if="status", :variant="status.variant") {{ status.label }}
            .order-detail__sub
              span.order-detail__num №&nbsp;{{ order.id.slice(0, 8) }}
              span(aria-hidden="true") ·
              span {{ formatDate(order.created_at) }}

        .order-detail__facts
          .order-detail__fact
            .order-detail__fact-label Сумма заказа
            .order-detail__fact-value--money {{ formatPrice(order.total_cost) }}
          .order-detail__fact
            .order-detail__fact-label Количество
            .order-detail__fact-value {{ order.quantity }} {{ unitShort }}
          .order-detail__fact
            .order-detail__fact-label Цена за единицу
            .order-detail__fact-value {{ formatPrice(order.price_per_unit) }}

        .order-detail__pvz(v-if="pvzName || pvzAddress")
          q-icon(name="place", size="18px")
          .order-detail__pvz-text
            .order-detail__pvz-name(v-if="pvzName") {{ pvzName }}
            .t-muted(v-if="pvzAddress") {{ pvzAddress }}

      BaseCard.order-detail__card(v-if="issuanceFact")
        template(#head)
          .t-h3 Факт выдачи
        table.order-detail__table
          thead
            tr
              th
              th.text-right Заказ
              th.text-right Факт
          tbody
            tr
              td Количество
              td.text-right {{ order.quantity }} {{ unitShort }}
              td.text-right {{ issuanceFact.actual_quantity }} {{ unitShort }}
            tr
              td Сумма
              td.text-right {{ formatPrice(order.total_cost) }}
              td.text-right {{ formatPrice(issuanceFact.fact_cost) }}

      BaseCard.order-detail__card(v-if="timeline.length")
        template(#head)
          .t-h3 Хронология
        .order-detail__timeline
          .order-detail__timeline-row(v-for="row in timeline", :key="row.label")
            span.t-muted {{ row.label }}
            span {{ row.value }}

      .order-detail__actions(v-if="cancellable || receivable")
        BaseButton(v-if="receivable", variant="primary", @click="finalizeDialogOpen = true")
          template(#icon-left)
            q-icon(name="draw", size="16px")
          | Подписать и получить
        BaseButton(v-if="cancellable", variant="danger", @click="confirmCancel") Отменить заказ

    OrdererFinalizeIssuanceDialog(
      v-model="finalizeDialogOpen",
      :order="order",
      @finalized="onFinalized"
    )
</template>

<style scoped lang="scss">
.order-detail {
  padding: 0 var(--p-4, 16px) var(--p-6, 24px);

  &__col {
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__back {
    align-self: flex-start;
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__head {
    width: 100%;
    min-width: 0;
  }

  &__head-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--p-3, 12px);
  }

  &__title {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  &__sub {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--p-1, 4px) var(--p-2, 8px);
    margin-top: var(--p-1, 4px);
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }

  &__num {
    font-family: var(--p-mono);
  }

  &__facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-3, 12px) var(--p-6, 24px);
  }

  &__fact-label {
    font-size: var(--p-fs-eyebrow, 11px);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-ink-3);
    margin-bottom: 2px;
  }

  &__fact-value {
    font-size: var(--p-fs-body);
    color: var(--p-ink);

    &--money {
      font-size: var(--p-fs-h2, 18px);
      font-weight: 700;
      font-feature-settings: 'tnum' 1;
      color: var(--p-ink);
    }
  }

  &__pvz {
    display: flex;
    align-items: flex-start;
    gap: var(--p-2, 8px);
    color: var(--p-ink-3);
  }

  &__pvz-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__pvz-name {
    color: var(--p-ink);
    overflow-wrap: anywhere;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;

    th,
    td {
      padding: var(--p-2, 8px);
      border-bottom: 1px solid var(--p-line);
    }

    th {
      font-size: var(--p-fs-body-sm);
      color: var(--p-ink-3);
      font-weight: 600;
    }
  }

  &__timeline {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__timeline-row {
    display: flex;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    font-size: var(--p-fs-body);
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--p-2, 8px);
  }
}

@media (max-width: 768px) {
  .order-detail {
    padding: 0 var(--p-3, 12px) var(--p-4, 16px);
  }
}
</style>
