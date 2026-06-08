<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Dialog } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { OrderCard, toOrderCardModel, type Order as OrderCardModel } from 'src/widgets/Marketplace/OrderCard';
import { RefreshButton } from 'src/widgets/Marketplace/RefreshButton';
import { BaseButton, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { HandoffCodeDialog } from 'src/widgets/Marketplace/HandoffCode';
import { HandoffTokenKind } from 'src/shared/lib/marketplace';
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
 * Код получения (account-bound QR) — кнопка «Получить заказ» в шапке: открывает
 * диалог с тем же QR, что и на отдельной странице меню (OrdererReceiveCode).
 *
 * Live-обновления — polling каждые 10s.
 */

const PAGE_SIZE = 24;
const POLL_INTERVAL_MS = 10_000;

const route = useRoute();
const router = useRouter();
const system = useSystemStore();
const coopname = computed(() => String(route.params.coopname ?? ''));

const items = ref<MarketplaceOrderView[]>([]);
const totalCount = ref(0);
const totalPages = ref(0);
const currentPage = ref(1);
const loading = ref(false);
const activeKey = ref('all');

const hasMore = computed(() => currentPage.value < totalPages.value);

// Финальная подпись получения — диалог прямо из карточки заказа, СВОДНЫЙ по
// всем готовым позициям пункта выдачи (пайщик подтверждает получение разом).
const finalizeDialogOpen = ref(false);
const selectedOrders = ref<MarketplaceOrderView[]>([]);

// Код получения (account-bound QR) — диалогом из шапки, в одном месте.
const receiveDialogOpen = ref(false);

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

const symbol = computed(() => system.governSymbol);

function money(value: string | number): string {
  return Number(value).toLocaleString('ru-RU');
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ru-RU');
}

/**
 * Story 16.6: группировка «Моих заказов» по ЗАКАЗАМ-агрегатам (checkout_id).
 *
 * Одно оформление корзины = один checkout_id = несколько построчных заказов на
 * один КУ. Показываем их одной группой с шапкой (дата/пункт/позиции/сумма).
 * Заказы без checkout_id (легаси-поштучные) и одиночные группы (1 позиция)
 * рисуются плоско, без шапки — лишний заголовок над одной карточкой не нужен.
 * Группировка идёт по уже отфильтрованному вкладкой списку: группа показывает
 * те позиции заказа-агрегата, что попали в текущий статус-фильтр.
 */
interface OrderGroup {
  key: string;
  isAggregate: boolean;
  orders: MarketplaceOrderView[];
  count: number;
  totalCost: number;
  deliveryName: string;
  createdAt: string;
  recent: number;
}

const groups = computed<OrderGroup[]>(() => {
  const map = new Map<string, MarketplaceOrderView[]>();
  for (const o of items.value) {
    const key = o.checkout_id ?? `single:${o.id}`;
    const arr = map.get(key) ?? [];
    arr.push(o);
    map.set(key, arr);
  }
  const result: OrderGroup[] = Array.from(map.entries()).map(([key, orders]) => {
    const first = orders[0];
    const recent = Math.max(...orders.map((o) => new Date(o.updated_at).getTime()));
    return {
      key,
      isAggregate: orders.length > 1,
      orders,
      count: orders.length,
      totalCost: orders.reduce((s, o) => s + Number(o.total_cost), 0),
      deliveryName: first?.delivery_point_name || first?.delivery_braname || '',
      createdAt: first?.created_at ?? '',
      recent,
    };
  });
  // Свежие заказы-агрегаты сверху — сохраняем порядок сортировки списка.
  result.sort((a, b) => b.recent - a.recent);
  return result;
});

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
    try {
      const result = await cancelOrder(order.id);
      SuccessAlert(`Заказ отменён. Средства разблокированы (tx ${result.tx_hash.slice(0, 8)}).`);
      await load(1, false);
    } catch (e) {
      FailAlert(e);
    }
  });
}

function startFinalize(order: MarketplaceOrderView): void {
  // Сводим все готовые к выдаче позиции этого же пункта — пайщик подтверждает
  // получение разом, одной подписью по каждой (циклом), не по одной кнопке на
  // позицию.
  const siblings = items.value.filter(
    (o) => o.status === 'READY_TO_RECEIVE' && o.delivery_braname === order.delivery_braname,
  );
  selectedOrders.value = siblings.length ? siblings : [order];
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

function goReceive(): void {
  receiveDialogOpen.value = true;
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
  //- Действия — в шапку (канон Teleport). «Получить заказ» дублируем здесь и
  //- на детали заказа, чтобы код выдачи был под рукой везде, не только на
  //- отдельной странице.
  Teleport(to="#header-actions-host", defer)
    BaseButton(variant="secondary", size="sm", @click="goReceive")
      template(#icon-left)
        q-icon(name="qr_code_2", size="16px")
      | Получить заказ
    RefreshButton(:loading="loading", @refresh="() => load(1, false)")

  PageHint(storage-key="mp:my-orders:banner-dismissed")
    | Все ваши заказы и их движение до выдачи на пункте. Заказ можно отменить
    | до приёма поставщиком, а после открытия выдачи — подписать и получить
    | прямо в карточке. Откройте карточку, чтобы увидеть подробности.

  PageTabs.orders__tabs(:tabs="tabs", :active-key="activeKey", @select="onSelectTab")

  //- Канон загрузки: скелетон на первичной загрузке, не пустой экран.
  CardListSkeleton(v-if="loading && !items.length", :count="3")

  EmptyState(
    v-if="!items.length && !loading",
    title="У вас пока нет заказов",
    body="Перейдите в каталог, чтобы оформить первый заказ."
  )
    template(#icon)
      q-icon(name="shopping_cart", size="48px")

  //- Story 16.6: заказы сгруппированы по заказу-агрегату (одно оформление
  //- корзины). Многопозиционные группы — под шапкой; одиночные — плоско.
  .orders__list(v-if="items.length")
    template(v-for="g in groups", :key="g.key")
      .orders__group(v-if="g.isAggregate")
        .orders__group-head
          q-icon(name="receipt_long", size="18px", color="primary")
          .orders__group-title Заказ от {{ formatDate(g.createdAt) }} · {{ g.deliveryName }}
          .orders__group-meta {{ g.count }} поз. · {{ money(g.totalCost) }} {{ symbol }}
        .orders__grid
          OrderCard(
            v-for="o in g.orders",
            :key="o.id",
            :order="toCardModel(o)",
            role="orderer",
            openable,
            @action="onCardAction",
            @open="openDetail"
          )
      .orders__grid(v-else)
        OrderCard(
          v-for="o in g.orders",
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
    :orders="selectedOrders",
    @finalized="onFinalized"
  )

  HandoffCodeDialog(v-model="receiveDialogOpen", :coopname="coopname", :kind="HandoffTokenKind.Receive")
</template>

<style scoped lang="scss">
.orders {
  // Воздух сверху как на столе поставщика — единый канон столов. Контент
  // ниже разводит flex-gap.
  padding: var(--p-6, 24px);
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

  // Список групп заказов-агрегатов: вертикальный ритм между группами.
  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--p-5, 20px);
  }

  // Шапка заказа-агрегата: дата/пункт слева, позиции/сумма справа.
  &__group {
    display: flex;
    flex-direction: column;
    gap: var(--p-3, 12px);
  }

  &__group-head {
    display: flex;
    align-items: center;
    gap: var(--p-2, 8px);
    padding-bottom: var(--p-2, 8px);
    border-bottom: 1px solid var(--p-line);
  }

  &__group-title {
    font-weight: 600;
    color: var(--p-ink);
  }

  &__group-meta {
    margin-left: auto;
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm);
    white-space: nowrap;
  }
}

@media (max-width: 768px) {
  .orders {
    padding: var(--p-4, 16px);
  }
}
</style>
