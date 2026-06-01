<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Dialog, Loading } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard } from 'src/shared/ui/base';
import { ActivityTimeline, type ActivityEvent } from 'src/shared/ui/domain';
import { RefreshButton } from 'src/widgets/Marketplace/RefreshButton';
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard';
import { marketplaceUnitShort } from 'src/shared/lib/consts/marketplace-units';
import { marketplaceOfferImageUrls } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { cancelOrder, fetchOrder } from '../../MyOrders/api';
import type { MarketplaceOrderView } from '../../MyOrders/types';
import { fetchOffer } from '../../MarketplaceOfferDetail/api';
import OrdererFinalizeIssuanceDialog from '../../MyOrders/ui/OrdererFinalizeIssuanceDialog.vue';

/**
 * Детальная страница заказа заказчика. Открывается кликом по карточке на
 * «Моих заказах» (route `marketplace-order-detail`). Показывает товар с
 * обложкой, состав, ПВЗ, хронологию этапов (канон `ActivityTimeline`) и факт
 * выдачи. Управление (отмена до акцепта, «Подписать и получить» на этапе
 * выдачи) — здесь же, дублируя действия карточки. Источник заказа —
 * `marketplaceGetOrder`; обложка догружается из оферты по `offer_id`.
 */

const POLL_INTERVAL_MS = 15_000;

const route = useRoute();
const router = useRouter();
const coopname = computed(() => String(route.params.coopname ?? ''));
const orderId = computed(() => String(route.params.orderId ?? ''));

const order = ref<MarketplaceOrderView | null>(null);
const coverUrl = ref<string>('');
const loading = ref(false);

const finalizeDialogOpen = ref(false);

const status = computed(() => (order.value ? orderStatusDisplay(order.value.status) : null));
const unitShort = computed(() => marketplaceUnitShort(order.value?.unit_of_measure));
const cancellable = computed(() => order.value?.status === 'ACTIVE');
const receivable = computed(() => order.value?.status === 'READY_TO_RECEIVE');

const pvzName = computed(() => order.value?.delivery_point_name || order.value?.delivery_braname || '');
const pvzAddress = computed(() => order.value?.delivery_point_address || '');

// Факт выдачи появляется, когда оператор открыл выдачу.
const issuanceFact = computed(() => order.value?.issuance_fact ?? null);

// Хронология этапов → канон ActivityTimeline. Берём только проставленные
// отметки времени; тип события задаёт цвет иконки на ленте.
const timelineEvents = computed<ActivityEvent[]>(() => {
  const o = order.value;
  if (!o) return [];
  const events: ActivityEvent[] = [];
  const add = (id: string, type: ActivityEvent['type'], icon: string, title: string, date: unknown) => {
    if (date !== null && date !== undefined && date !== '') {
      events.push({ id, type, icon, title, date: String(date) });
    }
  };
  add('created', 'create', 'shopping_cart', 'Заказ оформлен', o.created_at);
  add('accepted', 'sign', 'inventory_2', 'Принят поставщиком', o.accepted_at);
  add('opened', 'system', 'lock_open', 'Выдача открыта на пункте', o.chairman_signed_at);
  add('received', 'sign', 'check_circle', 'Заказ получен', o.received_at);
  add('cancelled', 'reject', 'cancel', 'Заказ отменён', o.cancelled_at);
  return events;
});

function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('ru-RU');
}

function formatPrice(value: string | null | undefined): string {
  return `${formatAsset2Digits(String(value ?? '0'))} ₽`;
}

async function loadCover(offerId: string): Promise<void> {
  if (!offerId) return;
  try {
    const offer = await fetchOffer(offerId);
    coverUrl.value = marketplaceOfferImageUrls(offer?.images)[0] ?? '';
  } catch {
    // Обложка некритична — без неё страница работает, показываем плейсхолдер.
    coverUrl.value = '';
  }
}

async function load(): Promise<void> {
  if (!orderId.value) return;
  loading.value = true;
  try {
    const fetched = await fetchOrder(orderId.value);
    order.value = fetched;
    if (fetched?.offer_id && !coverUrl.value) void loadCover(fetched.offer_id);
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
        .order-detail__hero
          .order-detail__cover
            q-img(
              v-if="coverUrl",
              :src="coverUrl",
              ratio="1",
              fit="cover"
            )
            .order-detail__cover-empty(v-else)
              q-icon(name="image", size="40px")

          .order-detail__hero-info
            .order-detail__hero-top
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

      BaseCard.order-detail__card(v-if="timelineEvents.length")
        template(#head)
          .t-h3 Хронология
        ActivityTimeline(:events="timelineEvents", group-by-date)

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
  // Воздух сверху: отделяем контент от шапки-топбара.
  padding: var(--p-4, 16px) var(--p-4, 16px) var(--p-6, 24px);

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

  // Шапка карточки: обложка слева, реквизиты справа; на узком — в столбик.
  &__hero {
    display: flex;
    gap: var(--p-4, 16px);
    align-items: flex-start;
  }

  &__cover {
    flex: 0 0 auto;
    width: 120px;
    height: 120px;
    border-radius: var(--p-r-md, 12px);
    overflow: hidden;
    border: 1px solid var(--p-line);
    background: var(--p-surface-2);

    :deep(.q-img) {
      width: 100%;
      height: 100%;
    }
  }

  &__cover-empty {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--p-ink-3);
  }

  &__hero-info {
    min-width: 0;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__hero-top {
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
    margin-top: calc(-1 * var(--p-2, 8px));
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

  &__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--p-2, 8px);
  }
}

@media (max-width: 600px) {
  .order-detail {
    padding: var(--p-3, 12px) var(--p-3, 12px) var(--p-4, 16px);

    &__hero {
      flex-direction: column;
    }

    &__cover {
      width: 100%;
      height: 200px;
    }
  }
}
</style>
