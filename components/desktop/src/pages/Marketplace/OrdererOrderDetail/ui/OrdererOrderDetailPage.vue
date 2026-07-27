<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Dialog, debounce } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard } from 'src/shared/ui/base';
import { Map as MapView } from 'src/shared/ui/Map';
import { ActivityTimeline, type ActivityEvent } from 'src/shared/ui/domain';
import { OfferGallery } from 'src/widgets/Marketplace/OfferGallery';
import { HandoffCodeDialog } from 'src/widgets/Marketplace/HandoffCode';
import {
  HandoffTokenKind,
  useMarketplaceRealtime,
  applyMembershipFee,
  getMembershipFeePercent,
} from 'src/shared/lib/marketplace';
import { orderStatusDisplay } from 'src/widgets/Marketplace/OrderCard';
import { marketplaceOrderUnitLabel, marketplaceOrderSaleUnit } from 'src/shared/lib/consts/marketplace-units';
import { marketplaceOfferImageUrls } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { formatDateToLocalTimezone, getTimezoneLabel } from 'src/shared/lib/utils/dates';
import { cancelOrder, fetchOrder } from '../../MyOrders/api';
import type { MarketplaceOrderView } from '../../MyOrders/types';
import { fetchOffer } from '../../MarketplaceOfferDetail/api';
import {
  SubmitReturnClaimDialog,
  ReturnClaimDetailsDialog,
  listMyReturnClaims,
  returnClaimStatusLabel,
  returnClaimStatusVariant,
  returnClaimDecisionLabel,
  OPEN_RETURN_CLAIM_STATUSES,
  type MarketplaceReturnClaimView,
} from '../../OrdererReturnClaims';

/**
 * Детальная страница заказа заказчика. Открывается кликом по карточке на
 * «Моих заказах» (route `marketplace-order-detail`). Показывает товар с
 * обложкой, состав, ПВЗ, хронологию этапов (канон `ActivityTimeline`) и факт
 * выдачи. Управление (отмена до акцепта, «Подписать и получить» на этапе
 * выдачи) — здесь же, дублируя действия карточки. Источник заказа —
 * `marketplaceGetOrder`; обложка догружается из оферты по `offer_id`.
 *
 * Гарантийный возврат живёт тоже здесь (не отдельным разделом меню): пока
 * заказ RECEIVED и не истёк `warranty_until`, доступна подача заявления;
 * статус уже поданной заявки виден рядом — заказчик отслеживает возврат в
 * контексте самого заказа, а не переключаясь на отдельный стол.
 *
 * Live-обновления — realtime: статус ИМЕННО ЭТОГО заказа сменился →
 * персональный ws-сигнал, карточка тихо перечитывается (чужие заказы
 * отфильтровываются по order_id из payload). Страховка — resync канала.
 */

const route = useRoute();
const router = useRouter();
const coopname = computed(() => String(route.params.coopname ?? ''));
const orderId = computed(() => String(route.params.orderId ?? ''));

const order = ref<MarketplaceOrderView | null>(null);
const offerImages = ref<string[]>([]);
const loading = ref(false);

const receiveDialogOpen = ref(false);

// Гарантийный возврат: подача заявления и его статус живут прямо на странице
// заказа (не отдельным разделом меню) — заказчик видит срок и действие там же,
// где остальную хронологию, вместо отдельного стола с select'ом заказа.
const returnClaims = ref<MarketplaceReturnClaimView[]>([]);
const submitReturnDialogOpen = ref(false);
const returnDetailsDialogOpen = ref(false);
const selectedReturnClaim = ref<MarketplaceReturnClaimView | null>(null);

const status = computed(() => (order.value ? orderStatusDisplay(order.value.status) : null));
const unitShort = computed(() =>
  marketplaceOrderUnitLabel(order.value?.unit_of_measure),
);
// Кол-во «как заказывал» (Эпик 18): по мере — базовое количество, упаковкой —
// число упаковок (а не итоговый объём в базовой единице). Для сверки
// «Заказ vs Факт» ниже используется база (unitShort) — там сравниваются
// количества в одной мере, включая возможную недопоставку неполной упаковки.
const orderSaleUnit = computed(() =>
  order.value
    ? marketplaceOrderSaleUnit(order.value.quantity, order.value.unit_of_measure, order.value.package_size)
    : { units: 0, unitLabel: '' },
);
const cancellable = computed(() => order.value?.status === 'ACTIVE');

// Заявление подаётся только по выданному заказу (RECEIVED) в пределах окна
// warranty_until — то же поле, которое ПВЗ-оператор устанавливает при
// публикации оффера (Offer.warranty_days), контракт фиксирует на выдаче.
const warrantyUntil = computed(() =>
  order.value?.warranty_until ? new Date(String(order.value.warranty_until)) : null,
);
const warrantyActive = computed(
  () => warrantyUntil.value !== null && warrantyUntil.value.getTime() > Date.now(),
);
// Дата гарантийного срока — форматированная строка для подписи в hero-блоке
// возврата ниже (returnSecondaryText), не отдельная строка сама по себе.
const warrantyRowValue = computed(() =>
  order.value?.warranty_until ? formatDate(order.value.warranty_until) : null,
);
// Возврат допустим по факту выдачи — если выдано меньше заказанного, вернуть
// можно только фактически полученное (backend отклонит запрос сверх этого).
const maxReturnQuantity = computed(
  () => issuanceFact.value?.actual_quantity ?? order.value?.quantity ?? 0,
);
const orderReturnClaims = computed(() =>
  returnClaims.value.filter((c) => c.order_id === orderId.value),
);
// Открытая заявка блокирует подачу новой — backend всё равно отклонит повтор.
const openReturnClaim = computed(
  () => orderReturnClaims.value.find((c) => OPEN_RETURN_CLAIM_STATUSES.has(c.status)) ?? null,
);
// Архивная (решённая) заявка — последняя по дате подачи, чтобы показать её
// исход, даже если по этому же заказу уже можно подать новую.
const latestArchivedReturnClaim = computed(() => {
  const archived = orderReturnClaims.value
    .filter((c) => !OPEN_RETURN_CLAIM_STATUSES.has(c.status))
    .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());
  return archived[0] ?? null;
});
const canSubmitReturn = computed(
  () => order.value?.status === 'RECEIVED' && warrantyActive.value && !openReturnClaim.value,
);
// Что показать в блоке возврата: открытая заявка приоритетнее архивной.
const displayedReturnClaim = computed(() => openReturnClaim.value ?? latestArchivedReturnClaim.value);

// Иконка+заголовок+подпись — единая композиция «что сейчас с возвратом»
// (как .onsite-gate__head рядом: иконка слева, жирная строка состояния,
// под ней приглушённая деталь). Статус заявления, если она есть, выносится
// в BaseBadge отдельно — здесь заголовок общий («Заявление на возврат»),
// чтобы не дублировать один и тот же текст дважды.
const returnHeroIcon = computed(() => {
  if (displayedReturnClaim.value) return 'inventory_2';
  if (canSubmitReturn.value) return 'event_available';
  return 'event_busy';
});
const returnPrimaryText = computed(() => {
  if (displayedReturnClaim.value) return 'Заявление на возврат';
  if (canSubmitReturn.value) return 'Гарантийный возврат доступен';
  return warrantyUntil.value ? 'Гарантийный срок истёк' : 'Гарантийный возврат не предусмотрен';
});
const returnSecondaryText = computed(() => {
  if (!warrantyRowValue.value) return '';
  return displayedReturnClaim.value || canSubmitReturn.value
    ? `Гарантийный срок — до ${warrantyRowValue.value}`
    : warrantyRowValue.value;
});

// requirement b6: заказчику показываем цену С членским взносом (как в
// каталоге) — order.total_cost_with_fee уже посчитан бэком (total_cost +
// membership_fee, зафиксированный контрактом по ставке на момент заказа).
const totalWithFee = computed(() => (order.value ? Number(order.value.total_cost_with_fee) : 0));
const unitPriceWithFee = computed(() =>
  order.value && order.value.quantity > 0 ? totalWithFee.value / order.value.quantity : 0,
);

// «Факт выдачи»: issuance_fact.fact_cost с бэка — себестоимость без взноса
// (та же природа, что order.total_cost). Доразбивка недо-/перевыдачи
// (computeIssuanceDiff, стол оператора) уже возвращает взнос пропорционально
// расхождению — здесь та же ставка применяется к каждой стороне отдельно,
// чтобы «Заказ» и «Факт» были в одних единицах с «Суммой заказа» выше.
const feePercent = ref(0);
const factCostWithFee = computed(() =>
  issuanceFact.value ? applyMembershipFee(Number(issuanceFact.value.fact_cost), feePercent.value) : 0,
);

const pvzName = computed(() => order.value?.delivery_point_name || order.value?.delivery_braname || '');
const pvzAddress = computed(() => order.value?.delivery_point_address || '');

// Координаты ПВЗ (живой геокод КУ) — карта «куда ехать» прямо на странице
// заказа. Показываем, только когда участок геокодирован.
const pvzLat = computed(() =>
  typeof order.value?.delivery_point_lat === 'number' ? order.value.delivery_point_lat : null,
);
const pvzLng = computed(() =>
  typeof order.value?.delivery_point_lng === 'number' ? order.value.delivery_point_lng : null,
);
const hasMap = computed(() => pvzLat.value !== null && pvzLng.value !== null);

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
  add('accepted', 'sign', 'inventory_2', 'Ожидает отгрузки', o.accepted_at);
  add('opened', 'system', 'lock_open', 'Выдача открыта на пункте', o.chairman_signed_at);
  add('received', 'sign', 'check_circle', 'Заказ получен', o.received_at);
  add('cancelled', 'reject', 'cancel', 'Заказ отменён', o.cancelled_at);

  // Гарантийный возврат — часть истории заказа, не только текущий статус в
  // карточке выше: подача заявления и каждое решение председателя тоже
  // попадают в общую хронологию.
  for (const claim of orderReturnClaims.value) {
    add(
      `return-submitted-${claim.id}`,
      'create',
      'assignment_return',
      'Заявление на гарантийный возврат подано',
      claim.created_at,
    );
    for (const entry of claim.decision_log) {
      const isReject = entry.decision === 'reject_remote' || entry.decision === 'reject_at_visit';
      add(
        `return-decision-${claim.id}-${entry.tx_hash}`,
        isReject ? 'reject' : 'sign',
        isReject ? 'cancel' : 'check_circle',
        returnClaimDecisionLabel(entry.decision),
        entry.at,
      );
    }
  }

  // Заказные и возвратные события идут из независимых источников — сводим в
  // единую хронологию сортировкой по факту времени (день группирует шаблон
  // ActivityTimeline сам, но порядок ВНУТРИ дня он не переставляет).
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
});

function formatDate(value: unknown): string {
  // Время с бэкенда в UTC — показываем в настроенном поясе платформы (по
  // умолчанию МСК, см. getTimezone()/env.TIMEZONE) и подписываем его явно:
  // «27.07.2026 19:33» без пояса неоднозначно для пайщика.
  const out = formatDateToLocalTimezone(value, 'DD.MM.YYYY HH:mm');
  return out ? `${out} ${getTimezoneLabel()}` : '—';
}

function formatPrice(value: string | null | undefined): string {
  return `${formatAsset2Digits(String(value ?? '0'))} ₽`;
}

async function loadImages(offerId: string): Promise<void> {
  if (!offerId) return;
  try {
    const offer = await fetchOffer(offerId);
    offerImages.value = marketplaceOfferImageUrls(offer?.images);
  } catch {
    // Изображения некритичны — без них страница работает, показываем плейсхолдер.
    offerImages.value = [];
  }
}

async function load(): Promise<void> {
  if (!orderId.value) return;
  loading.value = true;
  try {
    const fetched = await fetchOrder(orderId.value);
    order.value = fetched;
    if (fetched?.offer_id && !offerImages.value.length) void loadImages(fetched.offer_id);
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить заказ');
  } finally {
    loading.value = false;
  }
}

function goBack(): void {
  void router.push({ name: 'marketplace-my-orders', params: { coopname: coopname.value } });
}

function goReceive(): void {
  receiveDialogOpen.value = true;
}

async function loadReturnClaims(): Promise<void> {
  try {
    returnClaims.value = await listMyReturnClaims();
  } catch {
    // Некритично для страницы заказа — без данных просто не покажем блок возврата.
  }
}

function openSubmitReturn(): void {
  submitReturnDialogOpen.value = true;
}

function openReturnDetails(claim: MarketplaceReturnClaimView): void {
  selectedReturnClaim.value = claim;
  returnDetailsDialogOpen.value = true;
}

function confirmCancel(): void {
  const o = order.value;
  if (!o) return;
  Dialog.create({
    title: 'Отменить заказ?',
    message: `Заказ № ${o.id.slice(0, 8)} (${orderSaleUnit.value.units}×${orderSaleUnit.value.unitLabel || 'ед.'}, ${formatPrice(o.total_cost_with_fee)}) будет отменён. Средства разблокируются на кошельке Стола заказов.`,
    cancel: { label: 'Не отменять', flat: true },
    ok: { label: 'Отменить заказ', color: 'negative', unelevated: true },
    persistent: true,
  }).onOk(async () => {
    try {
      const result = await cancelOrder(o.id);
      SuccessAlert(`Заказ отменён. Средства разблокированы (tx ${result.tx_hash.slice(0, 8)}).`);
      await load();
    } catch (e) {
      FailAlert(e);
    }
  });
}

onMounted(() => {
  void load();
  void loadReturnClaims();
  void getMembershipFeePercent()
    .then((p) => {
      feePercent.value = p;
    })
    .catch(() => undefined);
});

// Открыта одна карточка — реагируем только на сигнал по её order_id, чужие
// переходы заказов пайщика страницу не дёргают.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useMarketplaceRealtime(
  {
    MarketplaceOrderStatusChangedEvent: (event) => {
      if (event.order_id === orderId.value) reloadLive();
    },
    // Председатель решил по заявлению (в т.ч. пока пайщик стоит у стойки на
    // очном осмотре) — вердикт обновляется сразу, без перезахода на страницу.
    MarketplaceReturnClaimStatusChangedEvent: () => void loadReturnClaims(),
  },
  { onResync: () => reloadLive() }
);
</script>

<template lang="pug">
q-page.order-detail(role="region", aria-label="Заказ")
  Teleport(to="#header-actions-host", defer)
    BaseButton(variant="secondary", size="sm", @click="goReceive")
      template(#icon-left)
        q-icon(name="qr_code_2", size="16px")
      | Получить заказ

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
            OfferGallery(:images="offerImages", :alt="order.product_name || 'Товар'", height="100%", placeholder-icon-size="40px")

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
                .order-detail__fact-value--money {{ formatPrice(String(totalWithFee)) }}
              .order-detail__fact
                .order-detail__fact-label Количество
                .order-detail__fact-value {{ orderSaleUnit.units }}×{{ orderSaleUnit.unitLabel }}
              .order-detail__fact
                .order-detail__fact-label Цена за единицу
                .order-detail__fact-value {{ formatPrice(String(unitPriceWithFee)) }}

      BaseCard.order-detail__card(v-if="pvzName || pvzAddress")
        template(#head)
          .t-h3 Где забрать
        .order-detail__pvz(:class="{ 'q-mb-sm': hasMap }")
          q-icon(name="place", size="18px")
          .order-detail__pvz-text
            .order-detail__pvz-name(v-if="pvzName") {{ pvzName }}
            .t-muted(v-if="pvzAddress") {{ pvzAddress }}
        MapView(v-if="hasMap", :lat="pvzLat ?? 0", :long="pvzLng ?? 0")

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
              td.text-right {{ order.quantity }}×{{ unitShort }}
              td.text-right {{ issuanceFact.actual_quantity }}×{{ unitShort }}
            tr
              td Сумма
              td.text-right {{ formatPrice(String(totalWithFee)) }}
              td.text-right {{ formatPrice(String(factCostWithFee)) }}

      BaseCard.order-detail__card(v-if="order.status === 'RECEIVED'")
        template(#head)
          .t-h3 Гарантийный возврат
        .order-detail__return
          .order-detail__return-hero
            q-icon.order-detail__return-icon(:name="returnHeroIcon", size="24px")
            .order-detail__return-text
              .order-detail__return-primary {{ returnPrimaryText }}
              .order-detail__return-secondary(v-if="returnSecondaryText") {{ returnSecondaryText }}
            BaseBadge.order-detail__return-badge(
              v-if="displayedReturnClaim"
              :variant="returnClaimStatusVariant(displayedReturnClaim.status)"
            )
              | {{ returnClaimStatusLabel(displayedReturnClaim.status) }}

          .order-detail__return-actions(v-if="displayedReturnClaim || canSubmitReturn")
            BaseButton(v-if="displayedReturnClaim", variant="ghost", size="sm", @click="openReturnDetails(displayedReturnClaim)") Подробнее
            BaseButton(
              v-if="canSubmitReturn"
              :variant="displayedReturnClaim ? 'secondary' : 'primary'"
              size="sm"
              @click="openSubmitReturn"
            )
              template(#icon-left)
                q-icon(name="assignment", size="16px")
              | {{ displayedReturnClaim ? 'Подать новое заявление' : 'Подать заявление на возврат' }}

      BaseCard.order-detail__card(v-if="timelineEvents.length")
        template(#head)
          .t-h3 Хронология
        ActivityTimeline(:events="timelineEvents", group-by-date)

      .order-detail__actions(v-if="cancellable")
        BaseButton(variant="danger", @click="confirmCancel") Отменить заказ

    HandoffCodeDialog(v-model="receiveDialogOpen", :coopname="coopname", :kind="HandoffTokenKind.Receive")

    SubmitReturnClaimDialog(
      v-model="submitReturnDialogOpen",
      :order-id="orderId",
      :max-quantity="maxReturnQuantity",
      :unit-of-measure="order?.unit_of_measure ?? null",
      @submitted="loadReturnClaims"
    )

    ReturnClaimDetailsDialog(
      v-model="returnDetailsDialogOpen",
      :claim="selectedReturnClaim"
    )
</template>

<style scoped lang="scss">
.order-detail {
  // Воздух сверху как на столе поставщика — единый канон столов.
  padding: var(--p-6, 24px) var(--p-4, 16px);

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
    gap: var(--p-4, 16px);
  }

  // Шапка карточки: обложка слева, реквизиты справа; на узком — в столбик.
  &__hero {
    display: flex;
    gap: var(--p-5, 20px);
    align-items: flex-start;
  }

  &__cover {
    flex: 0 0 auto;
    width: 144px;
    height: 144px;
    border-radius: var(--p-r-md, 12px);
    overflow: hidden;
    border: 1px solid var(--p-line);
    background: var(--p-surface-2);

    :deep(.q-img) {
      width: 100%;
      height: 100%;
    }
  }

  &__hero-info {
    min-width: 0;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
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
    gap: var(--p-4, 16px) var(--p-8, 32px);
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

  &__return {
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  // Иконка + жирная строка состояния + приглушённая деталь снизу — тот же
  // приём, что и .onsite-gate__head (гейт подписи): визуальный якорь слева,
  // иерархия размером/весом текста, а не бейджем-предложением.
  &__return-hero {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    min-width: 0;
  }

  &__return-icon {
    flex: 0 0 auto;
    color: var(--p-ink-3);
  }

  &__return-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1 1 auto;
  }

  &__return-primary {
    font-size: var(--p-fs-h3, 15px);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__return-secondary {
    font-size: var(--p-fs-body-sm, 13px);
    color: var(--p-ink-3);
  }

  &__return-badge {
    flex: 0 0 auto;
  }

  &__return-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--p-3, 12px);
    padding-top: var(--p-3, 12px);
    border-top: 1px solid var(--p-line);
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
