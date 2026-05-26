<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Dialog, Notify } from 'quasar';
import {
  CatalogOfferCard,
  type CatalogOffer,
  type CatalogOfferStatus,
} from 'src/widgets/Marketplace/CatalogOfferCard';
import { fetchMyOffers, triggerOpenSubscription } from '../api';
import type {
  MarketplaceOfferCycleTypeView,
  MarketplaceOfferStatusView,
  MarketplaceOfferView,
} from '../types';

/**
 * Эпик 3 / Story 3.4: offerer-стол «Мои предложения».
 *
 * Поставщик видит свои Offer'ы во всех 4 статусах: PENDING_MODERATION,
 * ACTIVE, REJECTED, WITHDRAWN. Канон `CatalogOfferCard` с цветными chip'ами
 * для статуса. Client-side фильтр + поиск по названию (backend
 * `marketplaceListMyOffers` принимает только пагинацию).
 *
 * Polling 30s — Offer'ы меняют статус через модерацию председателя
 * (`marketplaceApproveOffer` / `marketplaceRejectOffer`).
 */

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 30_000;

const items = ref<MarketplaceOfferView[]>([]);
const totalCount = ref(0);
const totalPages = ref(0);
const currentPage = ref(1);
const loading = ref(false);
const statusFilter = ref<MarketplaceOfferStatusView | null>(null);
const search = ref('');
// id предложений, по которым прямо сейчас идёт запуск поставки — блокируем
// повторное нажатие кнопки до ответа backend.
const triggeringIds = ref<Set<string>>(new Set());
let pollTimer: ReturnType<typeof setInterval> | null = null;

const STATUS_FILTER_OPTIONS: Array<{ label: string; value: MarketplaceOfferStatusView | null }> = [
  { label: 'Все', value: null },
  { label: 'На модерации', value: 'PENDING_MODERATION' },
  { label: 'Опубликованы', value: 'ACTIVE' },
  { label: 'Отклонены', value: 'REJECTED' },
  { label: 'Сняты', value: 'WITHDRAWN' },
];

const STATUS_TO_CARD: Record<MarketplaceOfferStatusView, CatalogOfferStatus> = {
  PENDING_MODERATION: 'moderation',
  ACTIVE: 'published',
  REJECTED: 'paused',
  WITHDRAWN: 'completed',
};

const filtered = computed(() => {
  let list = items.value;
  if (statusFilter.value) {
    list = list.filter((o) => o.status === statusFilter.value);
  }
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase();
    list = list.filter((o) => o.product_name.toLowerCase().includes(q));
  }
  return list;
});

const cards = computed<Array<CatalogOffer & { domainStatus: MarketplaceOfferStatusView; cycleType: MarketplaceOfferCycleTypeView; rejectReason: string | null }>>(() =>
  filtered.value.map((o) => ({
    id: o.id,
    title: o.product_name,
    description: o.description ?? '',
    remainUnits: o.unlimited_flag ? undefined : o.quantity_available - o.quantity_blocked,
    unitCost: parseFloat(o.price_per_unit) || 0,
    unitLabel: o.unit_of_measure,
    status: STATUS_TO_CARD[o.status],
    domainStatus: o.status,
    cycleType: o.cycle_type,
    rejectReason: o.reject_reason,
  })),
);

const counts = computed(() => {
  const total = items.value.length;
  const active = items.value.filter((o) => o.status === 'ACTIVE').length;
  const pending = items.value.filter((o) => o.status === 'PENDING_MODERATION').length;
  const rejected = items.value.filter((o) => o.status === 'REJECTED').length;
  return { total, active, pending, rejected };
});

const hasMore = computed(() => currentPage.value < totalPages.value);

async function load(page: number, append: boolean): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchMyOffers({ page, limit: PAGE_SIZE });
    items.value = append ? [...items.value, ...result.items] : result.items;
    totalCount.value = result.totalCount;
    totalPages.value = result.totalPages;
    currentPage.value = result.currentPage;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}

function loadMore(): void {
  if (hasMore.value && !loading.value) {
    void load(currentPage.value + 1, true);
  }
}

/**
 * Эпик 4 / Story 4.2: ручной запуск поставки по предложению с открытой
 * подпиской. Доступен только для ACTIVE-предложений с cycle_type=open_subscription.
 * Нажатие = акцепт всего накопленного пула заказов, действие необратимо —
 * поэтому подтверждаем через диалог. После успеха перезагружаем список
 * (остатки и счётчики меняются по итогам формирования партии).
 */
function triggerSupply(offerId: string, title: string): void {
  Dialog.create({
    title: 'Запустить поставку?',
    message:
      `Все накопленные заказы по предложению «${title}» будут разом зафиксированы в одну ` +
      'партию и приняты к поставке. Отменить запуск нельзя.',
    cancel: { label: 'Отмена', flat: true, noCaps: true },
    ok: { label: 'Запустить поставку', color: 'primary', unelevated: true, noCaps: true },
    persistent: true,
  }).onOk(() => {
    void runTrigger(offerId);
  });
}

async function runTrigger(offerId: string): Promise<void> {
  triggeringIds.value = new Set(triggeringIds.value).add(offerId);
  try {
    await triggerOpenSubscription(offerId);
    Notify.create({
      type: 'positive',
      message: 'Поставка запущена: заказы зафиксированы в партию и приняты.',
    });
    await load(1, false);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    const next = new Set(triggeringIds.value);
    next.delete(offerId);
    triggeringIds.value = next;
  }
}

onMounted(async () => {
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
q-page.mp-role-offerer.mp-my-offers(role="region", aria-label="Мои предложения")
  div.mp-my-offers__header
    div
      div.text-h5 Мои предложения
      div.text-caption.mp-my-offers__subtitle
        | Все ваши предложения в кооперативе: на модерации, опубликованные, отклонённые и снятые. Чтобы опубликовать новое — перейдите на «Создать предложение».
    q-space
    q-btn(flat, dense, round, icon="fa-solid fa-rotate", :loading="loading", @click="load(1, false)", aria-label="Обновить")

  div.row.q-col-gutter-md.mp-my-offers__counters
    div.col-6.col-md-3
      q-card(flat, bordered)
        q-card-section
          div.text-caption Всего
          div.text-h6 {{ counts.total }}
    div.col-6.col-md-3
      q-card(flat, bordered)
        q-card-section
          div.text-caption Активных
          div.text-h6.text-positive {{ counts.active }}
    div.col-6.col-md-3
      q-card(flat, bordered)
        q-card-section
          div.text-caption На модерации
          div.text-h6.text-warning {{ counts.pending }}
    div.col-6.col-md-3
      q-card(flat, bordered)
        q-card-section
          div.text-caption Отклонены
          div.text-h6.text-negative {{ counts.rejected }}

  div.row.q-col-gutter-md.items-center
    div.col-12.col-md-6
      q-input(
        v-model="search",
        outlined,
        dense,
        clearable,
        placeholder="Поиск по названию",
        debounce="200"
      )
        template(#prepend)
          q-icon(name="fa-solid fa-magnifying-glass")
    div.col-12.col-md-6
      q-btn-toggle(
        v-model="statusFilter",
        :options="STATUS_FILTER_OPTIONS",
        no-caps,
        spread,
        unelevated,
        toggle-color="primary"
      )

  q-inner-loading(:showing="loading && items.length === 0")
    q-spinner(color="primary", size="2em")

  div.mp-my-offers__empty(v-if="!loading && filtered.length === 0")
    q-icon(name="fa-solid fa-clipboard-list", size="48px", color="grey-5")
    div.text-subtitle1.q-mt-md Нет предложений в этом фильтре
    div.text-caption Если у вас нет ни одного предложения — создайте первое на странице «Создать предложение».

  div.mp-my-offers__grid(v-if="filtered.length > 0")
    div.mp-my-offers__cell(
      v-for="card in cards",
      :key="card.id"
    )
      CatalogOfferCard(:offer="card")
      div.mp-my-offers__reason(v-if="card.domainStatus === 'REJECTED' && card.rejectReason")
        q-icon(name="fa-solid fa-circle-exclamation", color="negative", size="14px")
        | {{ card.rejectReason }}
      q-btn(
        v-if="card.domainStatus === 'ACTIVE' && card.cycleType === 'open_subscription'",
        color="primary",
        unelevated,
        no-caps,
        icon="fa-solid fa-truck-fast",
        label="Запустить поставку",
        :loading="triggeringIds.has(card.id)",
        @click="triggerSupply(card.id, card.title)"
      )

  div.mp-my-offers__more(v-if="hasMore")
    q-btn(
      flat,
      no-caps,
      :loading="loading",
      label="Показать ещё",
      @click="loadMore"
    )
</template>

<style scoped lang="scss">
.mp-my-offers {
  padding: var(--mp-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);

  &__header {
    display: flex;
    align-items: flex-start;
    gap: var(--mp-space-md);
  }

  &__subtitle {
    color: var(--mp-on-surface-muted);
    max-width: 720px;
  }

  &__counters {
    margin-bottom: var(--mp-space-xs);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--mp-space-md);
  }

  &__cell {
    display: flex;
    flex-direction: column;
    gap: var(--mp-space-xs);
  }

  &__reason {
    display: flex;
    gap: var(--mp-space-xs);
    align-items: center;
    color: var(--mp-on-surface-muted);
    font-size: 12px;
    padding: 0 var(--mp-space-xs);
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--mp-space-xl) 0;
    color: var(--mp-on-surface-muted);
  }

  &__more {
    display: flex;
    justify-content: center;
    padding: var(--mp-space-md) 0;
  }
}
</style>
