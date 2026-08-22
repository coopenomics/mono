<script lang="ts" setup>
/**
 * Карточка одного заказа для реестров — общая для стола администратора и
 * стола ПВЗ. Раньше это же содержимое раскрывалось прямо в строке таблицы;
 * теперь это отдельная страница на каждом столе, а сюда вынесено само
 * наполнение, чтобы правка в одном месте чинила оба стола (2026-08-04).
 *
 * Заказ загружается сама карточка (`marketplaceGetOrder`) — страницам стола
 * остаётся только маршрут, заголовок и возврат к своему реестру. Что именно
 * доступно смотрящему, решает бэкенд: администратор видит любой заказ
 * кооператива, ПВЗ — любой заказ своего участка.
 */
import { computed, ref, watch } from 'vue';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
import { BaseBadge, BaseButton, BaseCard, EmptyState } from 'src/shared/ui/base';
import { EntityIdBadge } from 'src/shared/ui';
import { ActivityTimeline, DataRow, type ActivityEvent } from 'src/shared/ui/domain';
import { ProcessDetailCard } from 'src/widgets/Process/ProcessDetailCard';
import { OfferGallery } from 'src/widgets/Marketplace/OfferGallery';
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard';
import { fetchOrder, type MarketplaceOrderDetailView } from 'src/entities/MarketplaceOrder';

const SUPPLY_PROCESS_TYPE = 'p.mkt.supply';

const props = withDefaults(
  defineProps<{
    coopname: string;
    orderId: string;
    /** Ссылка «открыть предложение» — скрыта, если у роли нет права смотреть карточку предложения (стол ПВЗ). */
    showOfferLink?: boolean;
  }>(),
  { showOfferLink: true }
);

const emit = defineEmits<{
  (e: 'offer-click', offerId: string): void;
}>();

const order = ref<MarketplaceOrderDetailView | null>(null);
const loading = ref(true);
const notFound = ref(false);

async function load(): Promise<void> {
  if (!props.orderId) return;
  loading.value = true;
  notFound.value = false;
  try {
    order.value = await fetchOrder(props.orderId);
  } catch (e) {
    order.value = null;
    notFound.value = true;
    FailAlert(e, 'Не удалось загрузить заказ');
  } finally {
    loading.value = false;
  }
}

watch(() => props.orderId, () => void load(), { immediate: true });

const status = computed(() => (order.value ? orderStatusDisplay(order.value.status) : null));

const coverImages = computed(() => (order.value?.image_url ? [order.value.image_url] : []));

// Кол-во «как заказывал» (Эпик 18): по мере — базовое количество, упаковкой —
// число упаковок.
const saleUnit = computed(() =>
  order.value
    ? marketplaceOrderSaleUnit(order.value.quantity, order.value.unit_of_measure, order.value.package_size)
    : { units: 0, unitLabel: '' }
);

// Реестр показывает сумму, которую реально заплатил пайщик: себестоимость
// плюс членский взнос, зафиксированный в заказе, — не голую себестоимость.
const totalWithFee = computed(() =>
  order.value ? formatAsset2Digits(order.value.total_cost_with_fee) : '—'
);

const ordererTitle = computed(
  () => order.value?.orderer_name || order.value?.orderer_account || '—'
);
const supplierTitle = computed(
  () => order.value?.supplier_name || order.value?.supplier_account || '—'
);

function formatDate(d: unknown): string {
  if (d === null || d === undefined) return '—';
  const parsed = new Date(String(d));
  return Number.isNaN(parsed.getTime())
    ? String(d)
    : parsed.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
}

// Состояние заказа — канонической лентой ActivityTimeline: показываем только
// НАСТУПИВШИЕ вехи с датами (текущий статус виден бейджем в шапке). Причина
// (last_status_reason) — это описание соответствующего события (отмены/отказа),
// а не отдельная неподписанная строка «Причина» (непонятно «причина чего»).
const events = computed<ActivityEvent[]>(() => {
  const o = order.value;
  if (!o) return [];
  const ev: ActivityEvent[] = [];
  const placed = o.blocked_at ?? o.created_at;
  if (placed) {
    ev.push({ id: 'placed', type: 'create', icon: 'shopping_cart', title: 'Заказ размещён', date: formatDate(placed) });
  }
  if (o.accepted_at) {
    ev.push({ id: 'accepted', type: 'update', icon: 'inventory_2', title: 'Поставщик принял заказ', actor: supplierTitle.value, date: formatDate(o.accepted_at) });
  }
  if (o.chairman_signed_at) {
    ev.push({ id: 'chairman', type: 'sign', title: 'Принят кооперативом (АПП приёмки)', date: formatDate(o.chairman_signed_at) });
  }
  const issued = o.orderer_signed_at ?? o.received_at;
  if (issued) {
    ev.push({ id: 'issued', type: 'sign', title: 'Получен заказчиком (АПП выдачи)', actor: ordererTitle.value, date: formatDate(issued) });
  }
  if (o.cancelled_at) {
    ev.push({ id: 'cancelled', type: 'reject', title: orderStatusDisplay(o.status).label, description: o.last_status_reason || undefined, date: formatDate(o.cancelled_at) });
  } else if (o.last_status_reason) {
    ev.push({ id: 'reason', type: 'comment', title: 'Комментарий к статусу', description: o.last_status_reason, date: formatDate(o.updated_at) });
  }
  return ev;
});

function goToOffer(): void {
  if (!order.value?.offer_id) return;
  emit('offer-click', order.value.offer_id);
}
</script>

<template lang="pug">
.order-registry-detail(role="region", aria-label="Заказ")
  q-inner-loading(:showing="loading && !order")
    q-spinner(color="primary", size="2em")

  EmptyState(
    v-if="notFound && !loading",
    title="Заказ не найден",
    body="Заказ удалён или недоступен на этом столе."
  )
    template(#icon)
      q-icon(name="receipt_long", size="48px")

  template(v-if="order")
    BaseCard.order-registry-detail__card
      .order-registry-detail__hero
        .order-registry-detail__cover
          OfferGallery(
            :images="coverImages",
            :alt="order.product_name || 'Товар'",
            height="100%",
            placeholder-icon-size="40px"
          )

        .order-registry-detail__info
          .order-registry-detail__top
            .t-h2.order-registry-detail__title {{ order.product_name || 'Товар по предложению' }}
            BaseBadge(v-if="status", :variant="status.variant") {{ status.label }}

          .order-registry-detail__sub
            EntityIdBadge(:rawId="order.id.slice(0, 8)", copy-on-click)
            span(aria-hidden="true") ·
            span {{ formatDate(order.created_at) }}

          .order-registry-detail__facts
            .order-registry-detail__fact
              .order-registry-detail__fact-label Сумма заказа
              .order-registry-detail__fact-value--money {{ totalWithFee }}
            .order-registry-detail__fact
              .order-registry-detail__fact-label Количество
              .order-registry-detail__fact-value {{ saleUnit.units }} {{ saleUnit.unitLabel }}
            .order-registry-detail__fact
              .order-registry-detail__fact-label Цена за единицу
              .order-registry-detail__fact-value {{ formatAsset2Digits(order.price_per_unit) }}

          .order-registry-detail__actions(v-if="props.showOfferLink && order.offer_id")
            BaseButton(variant="secondary", size="sm", @click="goToOffer")
              template(#icon-left)
                q-icon(name="open_in_new", size="16px")
              | Открыть предложение

    BaseCard.order-registry-detail__card
      template(#head)
        .t-h3 Стороны заказа
      DataRow(label="Заказчик", :value="ordererTitle")
      DataRow(label="Поставщик", :value="supplierTitle")
      DataRow(
        v-if="order.delivery_point_name || order.delivery_point_address",
        label="Пункт выдачи",
        :value="[order.delivery_point_name, order.delivery_point_address].filter(Boolean).join(', ')"
      )

    BaseCard.order-registry-detail__card(v-if="events.length")
      template(#head)
        .t-h3 Состояние заказа
      ActivityTimeline(:events="events")

    //- Документы + операции + проводки процесса заказа (общий виджет).
    //- order_hash = хэш процесса p.mkt.supply. Без перехода в чужие реестры.
    ProcessDetailCard(
      v-if="order.order_hash",
      :coopname="props.coopname",
      :process-hash="order.order_hash",
      :process-type="SUPPLY_PROCESS_TYPE"
    )
    .text-body2.text-grey-7(v-else) Хэш процесса заказа недоступен
</template>

<style scoped lang="scss">
.order-registry-detail {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  min-height: 120px;

  &__card {
    width: 100%;
  }

  &__hero {
    display: flex;
    gap: var(--p-4, 16px);
    align-items: flex-start;
  }

  &__cover {
    flex: 0 0 140px;
    width: 140px;
    height: 140px;
    border-radius: var(--p-r-md, 12px);
    overflow: hidden;
    background: var(--p-surface-2);
  }

  &__info {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__top {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    flex-wrap: wrap;
  }

  &__title {
    margin: 0;
  }

  &__sub {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    flex-wrap: wrap;
    color: var(--p-ink-3);
    font-size: var(--p-fs-sm, 13px);
  }

  &__facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-5, 20px);
    margin-top: var(--p-2, 8px);
  }

  &__fact-label {
    color: var(--p-ink-3);
    font-size: var(--p-fs-sm, 13px);
  }

  &__fact-value {
    font-weight: 600;
  }

  &__fact-value--money {
    font-family: var(--p-mono);
    font-weight: 600;
  }

  &__actions {
    margin-top: var(--p-2, 8px);
  }
}

@media (max-width: 768px) {
  .order-registry-detail__hero {
    flex-direction: column;
  }

  .order-registry-detail__cover {
    flex: 0 0 auto;
    width: 100%;
    height: 180px;
  }
}
</style>
