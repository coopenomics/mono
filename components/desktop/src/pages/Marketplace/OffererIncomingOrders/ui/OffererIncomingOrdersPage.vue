<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Dialog } from 'quasar';
import { SuccessAlert, FailAlert, NotifyAlert } from 'src/shared/api';
import { useRoute, useRouter } from 'vue-router';
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import {
  OrderCard,
  toOrderCardModel,
  type Order as OrderCardModel,
} from 'src/widgets/Marketplace/OrderCard';
import { RefreshButton } from 'src/widgets/Marketplace/RefreshButton';
import {
  acceptOrdersBatch,
  declineOrdersBatch,
  fetchSupplierOrders,
} from '../api';
import type {
  MarketplaceOrderStatusView,
  MarketplaceOrderView,
} from '../../MyOrders/types';

/**
 * Эпик 4 / Story 4.5: offerer-стол «Входящие заказы».
 *
 * Поставщик видит заказы, по которым он supplier. Канон `OrderCard` с
 * `role='offerer'`. Polling 15s до Subscriptions Story 9.x.
 *
 * Вёрстка по канону MONO Platform v2: инфо-баннер (`.banner`), канон-меню
 * фильтра статусов (`.tabbar`, deep-linkable через `?status=`), скелетоны
 * вместо спиннера, EmptyState. Акцепт/отказ — прямо на карточке.
 */

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 15_000;
const SKELETON_COUNT = 6;

const router = useRouter();
const route = useRoute();

const items = ref<MarketplaceOrderView[]>([]);
const totalPages = ref(0);
const currentPage = ref(1);
const loading = ref(false);
const activeKey = ref('all');
let pollTimer: ReturnType<typeof setInterval> | null = null;

const hasMore = computed(() => currentPage.value < totalPages.value);

// Скелетон — только на первичной загрузке (список ещё пуст). Polling
// обновляет данные молча, без дёргания спиннером.
const showSkeleton = computed(() => loading.value && items.value.length === 0);

// Фильтр по этапу заказа. Каждая вкладка может покрывать НЕСКОЛЬКО статусов:
// «Ждут акцепта» — и сводные (ACCEPTED_PENDING_SUPPLIER), и индивидуальные
// (..._INDIVIDUAL) заказы, оба ждут акцепта поставщика. Раньше вкладка
// фильтровала только сводный статус, и индивидуальный заказ с кнопкой
// «Принять» в неё не попадал (отдельная вкладка «Индивидуальные» путала).
// `key` — стабильный слаг в URL (`?status=pending-accept`) для прямых ссылок.
// Покрытие исчерпывающее по enum'у MarketplaceOrderStatusView: каждый статус
// заказа попадает хотя бы в одну вкладку, иначе при фильтрации заказ молча
// «растекается» — пропадает из всех вкладок, кроме «Все». READY_TO_RECEIVE для
// поставщика — продолжение «у кооператива»; EXPIRED_*/RETURNED — терминальные
// вместе с отменами.
const FILTERS: Array<{ key: string; label: string; statuses: MarketplaceOrderStatusView[] | null }> = [
  { key: 'all', label: 'Все', statuses: null },
  {
    key: 'pending-accept',
    label: 'Ждут акцепта',
    statuses: ['ACCEPTED_PENDING_SUPPLIER', 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL'],
  },
  { key: 'accepted', label: 'Приняты', statuses: ['ACCEPTED'] },
  { key: 'supply-prepared', label: 'Поставка готова', statuses: ['SUPPLY_PREPARED'] },
  {
    key: 'accepted-to-coop',
    label: 'У кооператива',
    statuses: ['ACCEPTED_TO_COOP', 'READY_TO_RECEIVE'],
  },
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

function onSelectTab(tab: PageTab): void {
  if (activeKey.value === tab.key) return;
  activeKey.value = tab.key;
  const query = { ...route.query };
  if (tab.key === 'all') delete query.status;
  else query.status = tab.key;
  void router.replace({ query });
  void load(1, false);
}

// Маппинг доменного заказа в модель карточки — единый `toOrderCardModel`
// (статус-карта + реквизиты товара/ПВЗ) из виджета OrderCard.
const cards = computed<OrderCardModel[]>(() => items.value.map(toOrderCardModel));

async function load(page: number, append: boolean): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchSupplierOrders({
      statuses: activeStatuses.value,
      page,
      limit: PAGE_SIZE,
    });
    items.value = append ? [...items.value, ...result.items] : result.items;
    totalPages.value = result.totalPages;
    currentPage.value = result.currentPage;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function loadMore(): void {
  if (hasMore.value && !loading.value) {
    void load(currentPage.value + 1, true);
  }
}

async function onAccept(orderId: string): Promise<void> {
  loading.value = true;
  try {
    // Эпик 15: единый batch-accept по order_id[]. Здесь принимаем по одному
    // (партия из одного); мультивыбор группой (offer × КУ) — фоллоуап UI.
    await acceptOrdersBatch([orderId]);
    SuccessAlert('Заказ принят к поставке');
    await load(1, false);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function onDecline(orderId: string): void {
  Dialog.create({
    title: 'Отказ от заказа',
    message: 'Укажите причину отказа — она будет показана пайщику в его заказе.',
    prompt: { model: '', type: 'textarea', isValid: (val: string) => val.trim().length > 0 },
    cancel: { label: 'Отмена', flat: true, noCaps: true },
    ok: { label: 'Отказать', color: 'negative', noCaps: true },
    persistent: true,
  }).onOk(async (reason: string) => {
    loading.value = true;
    try {
      await declineOrdersBatch([orderId], reason.trim());
      NotifyAlert('Заказ отклонён');
      await load(1, false);
    } catch (e) {
      FailAlert(e);
    } finally {
      loading.value = false;
    }
  });
}

function onCardAction(payload: { key: string; order: OrderCardModel }): void {
  const orderId = String(payload.order.id);
  if (payload.key === 'accept') {
    void onAccept(orderId);
  } else if (payload.key === 'decline') {
    onDecline(orderId);
  }
}

onMounted(async () => {
  // Восстанавливаем фильтр из URL — поддержка прямых ссылок на статус.
  const slug = typeof route.query.status === 'string' ? route.query.status : null;
  const fromUrl = FILTERS.find((f) => f.key === slug);
  if (fromUrl) activeKey.value = fromUrl.key;

  await load(1, false);
  pollTimer = setInterval(() => {
    void load(1, false);
  }, POLL_INTERVAL_MS);
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<template lang="pug">
q-page.incoming-orders(role='region', aria-label='Входящие заказы поставщика')
  .incoming-orders__col
    PageHint(storage-key='mp:offerer-incoming:banner-dismissed')
      | Заказы пайщиков, по которым вы выступаете поставщиком. Примите или
      | отклоните заказ прямо на карточке. Дальнейшие действия по партии —
      | на странице «Подготовка отгрузки».

    PageTabs.incoming-orders__tabs(:tabs='tabs', :active-key='activeKey', @select='onSelectTab')
      template(#actions)
        RefreshButton(:loading='loading', @refresh='load(1, false)')

    //- Скелетон вместо спиннера — каркас карточек проявляется сразу.
    .row.q-col-gutter-md(v-if='showSkeleton')
      .col-12.col-sm-6.col-md-4(v-for='n in SKELETON_COUNT', :key='`skel-${n}`')
        .incoming-orders__skel
          .skel.skel--title.incoming-orders__skel-line.incoming-orders__skel-line--head
          .skel.skel--text.incoming-orders__skel-line.incoming-orders__skel-line--title
          .skel.skel--num.incoming-orders__skel-line.incoming-orders__skel-line--meta
          .skel.skel--text.incoming-orders__skel-line.incoming-orders__skel-line--meta

    EmptyState(
      v-if='!loading && items.length === 0',
      title='Нет заказов в этом фильтре',
      body='Когда пайщики оформят заказ на ваше предложение — он появится здесь.'
    )
      template(#icon)
        q-icon(name='inbox', size='48px')

    template(v-if='items.length > 0')
      .row.q-col-gutter-md
        .col-12.col-sm-6.col-md-4(v-for='card in cards', :key='card.id')
          OrderCard(:order='card', role='offerer', @action='onCardAction')

      .incoming-orders__more(v-if='hasMore')
        BaseButton(variant='ghost', :loading='loading', @click='loadMore') Показать ещё
</template>

<style scoped lang="scss">
.incoming-orders {
  // Меню-вкладки (PageTabs) прижимаются к топбару — верхний отступ страницы
  // гасим; контент ниже разводит flex-gap колонки.
  padding: 0 var(--p-4, 16px) var(--p-6, 24px);

  &__col {
    max-width: 1120px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  // Канон-`.tabbar` рассчитан на полноширинную под-навигацию; внутри
  // центрированной колонки выравниваем табы по её краю.
  &__tabs {
    :deep(.tabbar__tabs) {
      padding: 0;
    }
    :deep(.tabbar__actions) {
      padding-right: 0;
    }
  }

  // Скелетон-карточка повторяет форму OrderCard: шапка, название, мета-строки.
  &__skel {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-4, 16px);
  }

  &__skel-line {
    margin-top: var(--p-3, 12px);

    &:first-child {
      margin-top: 0;
    }
  }

  &__skel-line--head { width: 50%; }
  &__skel-line--title { width: 80%; }
  &__skel-line--meta { width: 60%; }

  &__more {
    display: flex;
    justify-content: center;
    padding: var(--p-4, 16px) 0;
  }
}
</style>
