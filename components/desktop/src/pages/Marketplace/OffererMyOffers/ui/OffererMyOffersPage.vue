<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { useMarketplaceRealtime, getMembershipFeePercent } from 'src/shared/lib/marketplace';
import { useRoute, useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { useHeaderActions } from 'src/shared/hooks';
import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts';
import { marketplaceOfferImageUrls } from 'src/shared/lib/utils';
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import { FilterBar, PageHint } from 'src/shared/ui/domain';
import CreateOfferHeaderButton from './CreateOfferHeaderButton.vue';
import {
  CatalogOfferCard,
  CatalogOfferCardSkeleton,
  type CatalogOffer,
  type CatalogOfferStatus,
} from 'src/widgets/Marketplace/CatalogOfferCard';
import { Zeus } from '@coopenomics/sdk';
import { republishOffer } from 'src/entities/MarketplaceOffer';
import { fetchMyOffers } from '../api';
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
 * Вёрстка по канону MONO Platform v2: инфо-баннер (`.banner`), канон-поиск
 * (`FilterBar`) и канон-меню фильтра статусов (`.tabbar`) — без KPI-плиток,
 * счётчики дублировали вкладки. Фильтр deep-linkable через query `?status=` —
 * на «На модерации» и т.п. можно перейти прямой ссылкой.
 *
 * Обновление — realtime: одобрение (новый оффер в каталоге) и изменение остатка
 * прилетают мгновенно через подписку marketplace; редкие события без сигнала
 * (отклонение модератором) подхватывает 60-сек catch-up канала. Ручного polling
 * нет. Подписанные URL картинок стабилизированы на бэкенде (окно getReadUrl),
 * поэтому при перезагрузке списка изображения не перекачиваются.
 */

const PAGE_SIZE = 50;

// Кол-во скелетон-карточек на время первичной загрузки.
const SKELETON_COUNT = 8;

// Карточку любого статуса можно открыть в редакторе. Отклонённую правят, чтобы
// устранить причину и переотправить; снятую (WITHDRAWN) — дорабатывают перед
// возвратом на публикацию (в редакторе кнопка «Опубликовать снова»). Открытым
// остаётся весь набор — недоступных к просмотру статусов нет.
const EDITABLE_STATUSES: ReadonlyArray<MarketplaceOfferStatusView> = [
  'PENDING_MODERATION',
  'ACTIVE',
  'REJECTED',
  'WITHDRAWN',
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
// Поставщик видит крупно свою цену; ниже — сколько заплатит заказчик
// (себестоимость + членский взнос), без процентов.
const feePercent = ref(0);

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
  WITHDRAWN: 'withdrawn',
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
    // `quantity_available` — уже свободный остаток (инвариант counters:
    // available + blocked + consumed = опубликовано; при заказе available
    // сразу уменьшается). Повторно вычитать `quantity_blocked` нельзя —
    // это двойное списание (100 опубликовал, заказали 1 → показывало 98).
    remainUnits: o.unlimited_flag ? undefined : o.quantity_available,
    unitCost: parseFloat(o.price_per_unit) || 0,
    unitLabel: marketplaceOrderUnitLabel(o.unit_of_measure, o.order_unit_size),
    status: STATUS_TO_CARD[o.status],
    domainStatus: o.status,
    rejectReason: o.reject_reason ?? null,
  })),
);

const hasMore = computed(() => currentPage.value < totalPages.value);

function goCard(card: OfferCard): void {
  if (!EDITABLE_STATUSES.includes(card.domainStatus)) return;
  void router.push({
    name: 'marketplace-edit-offer',
    params: { coopname: info.coopname, offerId: String(card.id) },
  });
}

const republishing = ref<string | null>(null);

// Снятое предложение возвращается на публикацию без пересоздания. Уже
// одобренное публикуется сразу (контент не менялся — модерировать нечего),
// ещё не одобренное уходит на модерацию; уведомление — по фактическому статусу.
async function onRepublish(card: OfferCard): Promise<void> {
  republishing.value = String(card.id);
  try {
    const status = await republishOffer(String(card.id));
    SuccessAlert(
      status === Zeus.MarketplaceOfferStatus.ACTIVE
        ? 'Предложение снова опубликовано.'
        : 'Предложение отправлено на модерацию.',
    );
    await load(1, false);
  } catch (e) {
    FailAlert(e);
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
  try {
    feePercent.value = await getMembershipFeePercent();
  } catch {
    // Без ставки показываем карточки без цены с учётом взноса.
  }
});

// Живое обновление вместо polling: одобрение/остаток прилетают сигналом,
// редкое отклонение модератором подхватывает 60-сек catch-up канала. Тихая
// перезагрузка списка (debounce коалесит всплески).
const reloadLive = debounce(() => {
  void load(1, false);
}, 400);

useMarketplaceRealtime(
  {
    MarketplaceOfferPublishedEvent: () => reloadLive(),
    MarketplaceOfferStockChangedEvent: () => reloadLive(),
    // Вердикт модерации (одобрено/отклонено) приходит в персональный канал
    // поставщика — статус-бейдж карточки обновляется сразу, без поллинга.
    MarketplaceOfferModerationEvent: () => reloadLive(),
  },
  { onResync: () => reloadLive() }
);
</script>

<template lang="pug">
q-page.my-offers(role="region", aria-label="Мои предложения")
  .my-offers__col
    PageHint(storage-key="mp:my-offers:banner-dismissed")
      | Все ваши предложения в кооперативе и их статус. Нажмите на карточку,
      | чтобы открыть предложение — изменить цену и остаток, отредактировать
      | описание или снять с публикации. Цена и количество меняются без
      | повторной модерации.

    FilterBar(
      v-model:search="search",
      search-placeholder="Поиск по названию",
      hide-reset
    )

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

    //- Скелетон вместо спиннера: каркас карточек проявляется сразу, без
    //- дёргания. Только на первичной загрузке — polling обновляет молча.
    .row.q-col-gutter-md(v-if="showSkeleton")
      .col-12.col-sm-6.col-md-4.col-lg-3(v-for="n in SKELETON_COUNT", :key="`skel-${n}`")
        CatalogOfferCardSkeleton

    EmptyState(
      v-if="!loading && filtered.length === 0",
      title="Нет предложений в этом фильтре",
      body="Если у вас нет ни одного предложения — создайте первое на странице «Создать предложение»."
    )

    template(v-if="filtered.length > 0")
      .row.q-col-gutter-md
        .col-12.col-sm-6.col-md-4.col-lg-3(v-for="card in cards", :key="card.id")
          CatalogOfferCard(:offer="card", :fee-percent="feePercent", @click="goCard(card)")
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
  }

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
