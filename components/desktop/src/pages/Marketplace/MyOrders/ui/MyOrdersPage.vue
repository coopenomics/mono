<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Dialog, Loading } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { OrderCard, toOrderCardModel, type Order as OrderCardModel } from 'src/widgets/Marketplace/OrderCard';
import { RefreshButton } from 'src/widgets/Marketplace/RefreshButton';
import { HandoffQr } from 'src/widgets/Marketplace/HandoffQr';
import { BaseButton, BaseDialog, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { encodeHandoffToken, HandoffTokenKind } from 'src/shared/lib/marketplace';
import { cancelOrder, fetchMyOrders } from '../api';
import type { MarketplaceOrderStatusView, MarketplaceOrderView } from '../types';
import OrdererFinalizeIssuanceDialog from './OrdererFinalizeIssuanceDialog.vue';

/**
 * Story 4.6: orderer-стол «Мои заказы».
 *
 * Единый список всех заказов пайщика во всех статусах. Канон —
 * `widgets/Marketplace/OrderCard`. Управление заказом живёт прямо в карточке:
 * «Отменить» (до акцепта) и «Подписать и получить» (когда оператор открыл
 * выдачу, статус READY_TO_RECEIVE) — отдельной страницы «Готово к получению»
 * больше нет. Клик по карточке открывает детальную страницу заказа.
 *
 * «Мой код получения» (account-bound QR) вынесен в шапку страницы — заказчик
 * показывает его оператору на пункте, тот выдаёт разом все готовые заказы.
 *
 * Live-обновления — polling каждые 10s.
 */

const PAGE_SIZE = 24;
const POLL_INTERVAL_MS = 10_000;

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const coopname = computed(() => String(route.params.coopname ?? ''));

const items = ref<MarketplaceOrderView[]>([]);
const totalCount = ref(0);
const totalPages = ref(0);
const currentPage = ref(1);
const loading = ref(false);
const activeKey = ref('all');

const hasMore = computed(() => currentPage.value < totalPages.value);

// Story 14.4: один account-bound код получения. Заказчик показывает его
// оператору выдачи — тот резолвит аккаунт против ленты своего КУ и видит разом
// все готовые к выдаче заказы этого заказчика. Код привязан к личности, не к
// заказу: его можно показать заранее или с распечатки.
const myCodeDialogOpen = ref(false);
const myReceiveCode = computed(() =>
  session.username
    ? encodeHandoffToken({
        kind: HandoffTokenKind.Receive,
        coopname: coopname.value,
        account: session.username,
      })
    : '',
);

// Финальная подпись получения — диалог прямо из карточки заказа.
const finalizeDialogOpen = ref(false);
const selectedOrder = ref<MarketplaceOrderView | null>(null);

// Фильтр по этапу. Покрытие ИСЧЕРПЫВАЮЩЕЕ по enum'у MarketplaceOrderStatusView:
// каждый статус заказа попадает хотя бы в одну вкладку. Иначе заказ молча
// «растекается» — пропадает из всех вкладок, кроме «Все» (баг: молоко в статусе
// SUPPLY_PREPARED не показывалось нигде). Вкладка может покрывать несколько
// статусов: «Ждут поставщика» — сводные и индивидуальные (оба ждут акцепта);
// «Готовятся» — принят → готовится → принят кооперативом (для заказчика это
// единый этап «в работе»); «Отменены» — отмены, истёкшие циклы и возвраты.
const FILTERS: Array<{ key: string; label: string; statuses: MarketplaceOrderStatusView[] | null }> = [
  { key: 'all', label: 'Все', statuses: null },
  { key: 'active', label: 'Активные', statuses: ['ACTIVE'] },
  {
    key: 'pending-supplier',
    label: 'Ждут поставщика',
    statuses: ['ACCEPTED_PENDING_SUPPLIER', 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL'],
  },
  {
    key: 'in-progress',
    label: 'В работе',
    statuses: ['ACCEPTED', 'SUPPLY_PREPARED', 'ACCEPTED_TO_COOP'],
  },
  { key: 'ready', label: 'Готовы к выдаче', statuses: ['READY_TO_RECEIVE'] },
  { key: 'received', label: 'Получены', statuses: ['RECEIVED'] },
  {
    key: 'closed',
    label: 'Отменены',
    statuses: [
      'CANCELLED_BY_ORDERER',
      'CANCELLED_BY_SUPPLIER',
      'RETURNED',
    ],
  },
];

const tabs = computed<PageTab[]>(() => FILTERS.map((f) => ({ key: f.key, label: f.label })));

const activeStatuses = computed<MarketplaceOrderStatusView[] | undefined>(
  () => FILTERS.find((f) => f.key === activeKey.value)?.statuses ?? undefined,
);

// Маппинг доменного заказа в модель карточки — единый `toOrderCardModel`
// (статус-карта + реквизиты товара/ПВЗ) из виджета OrderCard.
const toCardModel = toOrderCardModel;

async function load(page: number, append: boolean): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchMyOrders({
      statuses: activeStatuses.value,
      page,
      limit: PAGE_SIZE,
      sortBy: 'updated_at',
      sortOrder: 'DESC',
    });
    totalCount.value = result.totalCount;
    totalPages.value = result.totalPages;
    currentPage.value = result.currentPage;
    items.value = append ? items.value.concat(result.items) : result.items;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function onSelectTab(tab: PageTab): void {
  if (activeKey.value === tab.key) return;
  activeKey.value = tab.key;
  void load(1, false);
}

async function onLoadMore(): Promise<void> {
  if (!hasMore.value || loading.value) return;
  await load(currentPage.value + 1, true);
}

function confirmCancel(order: MarketplaceOrderView): void {
  Dialog.create({
    title: 'Отменить заказ?',
    message: `Заказ № ${order.id.slice(0, 8)} (${order.quantity} ед., ${order.total_cost} ₽) будет отменён. Средства разблокируются на кошельке Стола заказов.`,
    cancel: { label: 'Не отменять', flat: true },
    ok: { label: 'Отменить заказ', color: 'negative', unelevated: true },
    persistent: true,
  }).onOk(async () => {
    Loading.show({ message: 'Отменяю заказ…' });
    try {
      const result = await cancelOrder(order.id);
      SuccessAlert(`Заказ отменён. Средства разблокированы (tx ${result.tx_hash.slice(0, 8)}).`);
      await load(1, false);
    } catch (e) {
      FailAlert(e);
    } finally {
      Loading.hide();
    }
  });
}

function startFinalize(order: MarketplaceOrderView): void {
  selectedOrder.value = order;
  finalizeDialogOpen.value = true;
}

function onFinalized(): void {
  void load(currentPage.value, false);
}

function openDetail(order: OrderCardModel): void {
  void router.push({
    name: 'marketplace-order-detail',
    params: { coopname: coopname.value, orderId: String(order.id) },
  });
}

function onCardAction(payload: { key: string; order: OrderCardModel }): void {
  const found = items.value.find((o) => o.id === payload.order.id);
  if (!found) return;
  if (payload.key === 'cancel') confirmCancel(found);
  else if (payload.key === 'receive') startFinalize(found);
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  void load(1, false);
  pollTimer = setInterval(() => {
    if (!loading.value) void load(currentPage.value, false);
  }, POLL_INTERVAL_MS);
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template lang="pug">
q-page.orders(role="region", aria-label="Мои заказы")
  //- Код получения и обновление — в шапку (канон Teleport).
  Teleport(to="#header-actions-host", defer)
    BaseButton(variant="secondary", size="sm", :disabled="!myReceiveCode", @click="myCodeDialogOpen = true")
      template(#icon-left)
        q-icon(name="qr_code_2", size="16px")
      | Мой код получения
    RefreshButton(:loading="loading", @refresh="() => load(1, false)")

  PageHint(storage-key="mp:my-orders:banner-dismissed")
    | Все ваши заказы и их движение до выдачи на пункте. Заказ можно отменить
    | до приёма поставщиком, а после открытия выдачи — подписать и получить
    | прямо в карточке. Откройте карточку, чтобы увидеть подробности.

  PageTabs.orders__tabs(:tabs="tabs", :active-key="activeKey", @select="onSelectTab")

  EmptyState(
    v-if="!items.length && !loading",
    title="У вас пока нет заказов",
    body="Перейдите в каталог, чтобы оформить первый заказ."
  )
    template(#icon)
      q-icon(name="shopping_cart", size="48px")

  .orders__grid(v-if="items.length")
    OrderCard(
      v-for="o in items",
      :key="o.id",
      :order="toCardModel(o)",
      role="orderer",
      openable,
      @action="onCardAction",
      @open="openDetail"
    )

  .row.justify-center.q-my-md(v-if="hasMore")
    BaseButton(variant="ghost", :loading="loading", @click="onLoadMore") Загрузить ещё

  OrdererFinalizeIssuanceDialog(
    v-model="finalizeDialogOpen",
    :order="selectedOrder",
    @finalized="onFinalized"
  )

  BaseDialog(v-model="myCodeDialogOpen", title="Мой код получения", size="sm")
    .orders__qr(v-if="myReceiveCode")
      HandoffQr(
        :value="myReceiveCode",
        caption="Покажите этот код оператору на пункте выдачи — он выдаст разом все ваши готовые заказы. Код можно показать заранее или с распечатки."
      )
</template>

<style scoped lang="scss">
.orders {
  // Меню-вкладки (PageTabs) прижимаются к топбару — гасим верхний отступ
  // страницы; контент ниже разводит flex-gap.
  padding: 0 var(--p-6, 24px) var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  // Канон-tabbar тянется во всю ширину; в странице с боковыми отступами
  // убираем его внутренний горизонтальный паддинг, чтобы вкладки шли от края.
  &__tabs {
    margin: 0 calc(-1 * var(--p-6, 24px));
    :deep(.tabbar__tabs) {
      padding: 0 var(--p-6, 24px);
    }
  }

  // Карточки фиксированной ширины (≤360px), выровнены влево — раньше `1fr`
  // растягивал одинокую карточку во всю строку и она «размазывалась».
  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 360px));
    justify-content: start;
    gap: var(--p-4, 16px);
  }

  &__qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--p-3, 12px);
    padding: var(--p-2, 8px) 0;
  }
}

@media (max-width: 768px) {
  .orders {
    padding: 0 var(--p-4, 16px) var(--p-4, 16px);
  }
}
</style>
