<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Notify } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { useDismissibleBanner, useHeaderActions } from 'src/shared/hooks';
import { marketplaceUnitShort } from 'src/shared/lib/consts';
import { marketplaceOfferImageUrls } from 'src/shared/lib/utils';
import { BaseButton, BaseCard, BaseInput, EmptyState } from 'src/shared/ui/base';
import CreateOfferHeaderButton from './CreateOfferHeaderButton.vue';
import {
  CatalogOfferCard,
  type CatalogOffer,
  type CatalogOfferStatus,
} from 'src/widgets/Marketplace/CatalogOfferCard';
import { fetchMyOffers, republishOffer } from '../api';
import type { MarketplaceOfferStatusView, MarketplaceOfferView } from '../types';

/**
 * Эпик 3 / Story 3.4: offerer-стол «Мои предложения».
 *
 * Поставщик видит свои Offer'ы во всех 4 статусах: PENDING_MODERATION,
 * ACTIVE, REJECTED, WITHDRAWN. Канон `CatalogOfferCard` со статус-чипом.
 * Client-side фильтр по статусу + поиск по названию (backend
 * `marketplaceListMyOffers` принимает только пагинацию).
 *
 * Клик по карточке/изображению редактируемой оферты ведёт сразу на страницу
 * редактирования (`marketplace-edit-offer`) — там же статус, кнопки «Снять с
 * публикации» и «Запустить поставку». Отдельного диалога-просмотра больше нет.
 *
 * Вёрстка по канону MONO Platform v2: инфо-баннер (`.banner`), дашборд-метрики
 * (BaseCard), полноширинный поиск и канон-меню фильтра статусов (`.tabbar`).
 * Фильтр deep-linkable через query `?status=` — на «На модерации» и т.п. можно
 * перейти прямой ссылкой.
 *
 * Polling 30s — Offer'ы меняют статус через модерацию председателя.
 * Подписанные URL картинок стабилизированы на бэкенде (окно getReadUrl),
 * поэтому при перезагрузке списка изображения не перекачиваются.
 */

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 30_000;

// Кол-во скелетон-карточек на время первичной загрузки.
const SKELETON_COUNT = 8;

// Открыть форму редактирования можно для активной, ожидающей модерации и
// отклонённой оферты. Отклонённую правят, чтобы устранить причину и
// переотправить на модерацию. Снятую (WITHDRAWN) backend на edit не пускает —
// её сначала возвращают на публикацию кнопкой «Опубликовать снова».
const EDITABLE_STATUSES: ReadonlyArray<MarketplaceOfferStatusView> = [
  'PENDING_MODERATION',
  'ACTIVE',
  'REJECTED',
];

const router = useRouter();
const route = useRoute();
const { info } = useSystemStore();
const { registerAction } = useHeaderActions();

const items = ref<MarketplaceOfferView[]>([]);
const totalPages = ref(0);
const currentPage = ref(1);
const loading = ref(false);
const statusFilter = ref<MarketplaceOfferStatusView | null>(null);
const search = ref('');
const { dismissed: bannerDismissed, dismiss: dismissBanner } = useDismissibleBanner(
  'mp:my-offers:banner-dismissed',
);
let pollTimer: ReturnType<typeof setInterval> | null = null;

// Скелетон показываем только на первичной загрузке (список ещё пуст). При
// polling'е данные обновляются молча — без дёргания спиннером.
const showSkeleton = computed(() => loading.value && items.value.length === 0);

// Фильтр статусов = канон-меню `.tabbar`. `slug` — стабильный ключ в URL
// (`?status=moderation`), чтобы на любой фильтр можно было перейти ссылкой.
const STATUS_FILTER_OPTIONS: Array<{
  label: string;
  value: MarketplaceOfferStatusView | null;
  slug: string;
}> = [
  { label: 'Все', value: null, slug: 'all' },
  { label: 'На модерации', value: 'PENDING_MODERATION', slug: 'moderation' },
  { label: 'Опубликовано', value: 'ACTIVE', slug: 'published' },
  { label: 'Отклонено', value: 'REJECTED', slug: 'rejected' },
  { label: 'Сняты', value: 'WITHDRAWN', slug: 'withdrawn' },
];

function isActiveTab(value: MarketplaceOfferStatusView | null): boolean {
  return statusFilter.value === value;
}

function setFilter(option: (typeof STATUS_FILTER_OPTIONS)[number]): void {
  if (statusFilter.value === option.value) return;
  statusFilter.value = option.value;
  const query = { ...route.query };
  if (option.value) query.status = option.slug;
  else delete query.status;
  void router.replace({ query });
}

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

type OfferCard = CatalogOffer & {
  domainStatus: MarketplaceOfferStatusView;
  rejectReason: string | null;
};

const cards = computed<OfferCard[]>(() =>
  filtered.value.map((o) => ({
    id: o.id,
    title: o.product_name,
    description: o.description ?? '',
    images: marketplaceOfferImageUrls(o.images),
    remainUnits: o.unlimited_flag ? undefined : o.quantity_available - o.quantity_blocked,
    unitCost: parseFloat(o.price_per_unit) || 0,
    unitLabel: marketplaceUnitShort(o.unit_of_measure),
    status: STATUS_TO_CARD[o.status],
    domainStatus: o.status,
    rejectReason: o.reject_reason ?? null,
  })),
);

const counters = computed(() => {
  const total = items.value.length;
  const active = items.value.filter((o) => o.status === 'ACTIVE').length;
  const pending = items.value.filter((o) => o.status === 'PENDING_MODERATION').length;
  const rejected = items.value.filter((o) => o.status === 'REJECTED').length;
  return [
    { label: 'Всего', value: total, cls: '' },
    { label: 'Опубликовано', value: active, cls: 'text-positive' },
    { label: 'На модерации', value: pending, cls: 'text-warning' },
    { label: 'Отклонено', value: rejected, cls: 'text-negative' },
  ];
});

const hasMore = computed(() => currentPage.value < totalPages.value);

function goCard(card: OfferCard): void {
  if (!EDITABLE_STATUSES.includes(card.domainStatus)) return;
  void router.push({
    name: 'marketplace-edit-offer',
    params: { coopname: info.coopname, offerId: String(card.id) },
  });
}

const republishing = ref<string | null>(null);

// Снятое предложение возвращается на публикацию без пересоздания — backend
// просто меняет статус на PENDING_MODERATION, данные оферты сохранены.
async function onRepublish(card: OfferCard): Promise<void> {
  republishing.value = String(card.id);
  try {
    await republishOffer(String(card.id));
    Notify.create({ type: 'positive', message: 'Предложение возвращено на модерацию.' });
    await load(1, false);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    republishing.value = null;
  }
}

async function load(page: number, append: boolean): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchMyOffers({ page, limit: PAGE_SIZE });
    items.value = append ? [...items.value, ...result.items] : result.items;
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

onMounted(async () => {
  // Канон: «Создать предложение» живёт в правом верхнем углу шапки (телепорт),
  // а не в меню. useHeaderActions сам снимет кнопку при уходе со страницы.
  registerAction({
    id: 'marketplace-create-offer',
    component: CreateOfferHeaderButton,
    order: 10,
  });

  // Восстанавливаем фильтр из URL — поддержка прямых ссылок на статус.
  const slug = typeof route.query.status === 'string' ? route.query.status : null;
  const fromUrl = STATUS_FILTER_OPTIONS.find((o) => o.slug === slug);
  if (fromUrl) statusFilter.value = fromUrl.value;

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
q-page.my-offers(role="region", aria-label="Мои предложения")
  .my-offers__col
    .banner.banner--info(v-if="!bannerDismissed")
      q-icon.banner__icon(name="info", size="18px")
      .banner__body
        | Все ваши предложения в кооперативе и их статус. Нажмите на карточку,
        | чтобы открыть предложение — изменить цену и остаток, отредактировать
        | описание или снять с публикации. Цена и количество меняются без
        | повторной модерации.
      BaseButton.my-offers__banner-close(
        variant="ghost",
        icon-only,
        size="sm",
        aria-label="Скрыть подсказку",
        @click="dismissBanner"
      )
        template(#icon-left)
          q-icon(name="close", size="16px")

    .row.q-col-gutter-md
      .col-6.col-md-3(v-for="kpi in counters", :key="kpi.label")
        BaseCard
          .text-caption.text-grey-7 {{ kpi.label }}
          .text-h5(:class="kpi.cls") {{ kpi.value }}

    BaseInput(v-model="search", placeholder="Поиск по названию", clearable)
      template(#prepend)
        q-icon(name="search")

    nav.tabbar.my-offers__tabs
      .tabbar__tabs
        button.tab(
          v-for="opt in STATUS_FILTER_OPTIONS",
          :key="opt.slug",
          type="button",
          :class="{ 'tab--active': isActiveTab(opt.value) }",
          @click="setFilter(opt)"
        )
          span {{ opt.label }}
      .tabbar__actions
        BaseButton(
          variant="ghost",
          icon-only,
          aria-label="Обновить",
          :loading="loading",
          @click="load(1, false)"
        )
          template(#icon-left)
            q-icon(name="refresh", size="20px")

    //- Скелетон вместо спиннера: каркас карточек проявляется сразу, без
    //- дёргания. Только на первичной загрузке — polling обновляет молча.
    .row.q-col-gutter-md(v-if="showSkeleton")
      .col-12.col-sm-6.col-md-4.col-lg-3(v-for="n in SKELETON_COUNT", :key="`skel-${n}`")
        .my-offers__skel
          .skel.my-offers__skel-media
          .skel.skel--title.my-offers__skel-line.my-offers__skel-line--title
          .skel.skel--num.my-offers__skel-line.my-offers__skel-line--price
          .skel.skel--text.my-offers__skel-line.my-offers__skel-line--cat

    EmptyState(
      v-if="!loading && filtered.length === 0",
      title="Нет предложений в этом фильтре",
      body="Если у вас нет ни одного предложения — создайте первое на странице «Создать предложение»."
    )

    template(v-if="filtered.length > 0")
      .row.q-col-gutter-md
        .col-12.col-sm-6.col-md-4.col-lg-3(v-for="card in cards", :key="card.id")
          CatalogOfferCard(:offer="card", @click="goCard(card)")
          .my-offers__reason(v-if="card.domainStatus === 'REJECTED' && card.rejectReason")
            q-icon(name="error", color="negative", size="16px")
            span {{ card.rejectReason }}
          .my-offers__action(v-if="card.domainStatus === 'WITHDRAWN'")
            BaseButton(
              variant="secondary",
              size="sm",
              block,
              :loading="republishing === String(card.id)",
              @click="onRepublish(card)"
            )
              template(#icon-left)
                q-icon(name="publish", size="16px")
              | Опубликовать снова

      .my-offers__more(v-if="hasMore")
        BaseButton(variant="ghost", :loading="loading", @click="loadMore") Показать ещё
</template>

<style scoped lang="scss">
.my-offers {
  padding: var(--p-6, 24px) var(--p-4, 16px);

  &__col {
    max-width: 1120px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  // Канон-`.tabbar` рассчитан на полноширинную под-навигацию с большим
  // боковым padding'ом; внутри центрированной колонки выравниваем табы по её
  // краю, сохраняя нижнюю границу и активный underline.
  &__tabs {
    :deep(.tabbar__tabs) {
      padding: 0;
    }
    :deep(.tabbar__actions) {
      padding-right: 0;
    }
  }

  // Крестик скрытия подсказки — прижат к правому краю баннера.
  &__banner-close {
    flex-shrink: 0;
    align-self: flex-start;
    margin: -4px -4px 0 0;
  }

  // Скелетон-карточка повторяет форму CatalogOfferCard: медиа сверху,
  // под ней — название, цена и категория.
  &__skel {
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md, 12px);
    overflow: hidden;
    padding-bottom: var(--p-3, 12px);
  }

  &__skel-media {
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: 0;
  }

  &__skel-line {
    margin-top: var(--p-3, 12px);
    margin-left: var(--p-3, 12px);
    margin-right: var(--p-3, 12px);
  }

  &__skel-line--title { width: 70%; }
  &__skel-line--price { width: 40%; }
  &__skel-line--cat { width: 85%; }

  &__reason {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: var(--p-2, 8px);
    font-size: var(--p-fs-meta, 12px);
    line-height: 1.4;
    color: var(--p-ink-2);
  }

  &__action {
    margin-top: var(--p-2, 8px);
  }

  &__more {
    display: flex;
    justify-content: center;
    padding: var(--p-4, 16px) 0;
  }
}
</style>
