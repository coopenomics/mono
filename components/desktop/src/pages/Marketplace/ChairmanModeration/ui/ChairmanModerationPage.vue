<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { fetchCategories } from '../../MarketplaceCatalog/api';
import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts';
import { marketplaceOfferImageUrls } from 'src/shared/lib/utils';
import { useMarketplaceRealtime, getMembershipFeePercent } from 'src/shared/lib/marketplace';
import { BaseButton, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import {
  CatalogOfferCard,
  type CatalogOffer,
} from 'src/widgets/Marketplace/CatalogOfferCard';
import { useOfferModeration } from 'src/features/Marketplace/OfferModeration';
import {
  fetchPendingOffers,
  type MarketplacePendingOfferView,
} from '../api';

/**
 * Эпик 3 / Story 3.6: модерация offer'ов председателем кооператива.
 *
 * Лента offer'ов в статусе PENDING_MODERATION. По «Одобрить» вызывается
 * `marketplaceApproveOffer`, статус становится APPROVED, offer пропадает из
 * ленты (фильтр на бэкенде) и появляется в публичном каталоге Story 3.5.
 *
 * Канон UI — `widgets/Marketplace/CatalogOfferCard` (UX-DR10) с per-card
 * action-кнопкой «Одобрить» через slot `actions`.
 */

const PAGE_SIZE = 24;

const route = useRoute();
const router = useRouter();

const items = ref<MarketplacePendingOfferView[]>([]);
const total = ref(0);
const loading = ref(false);
const currentPage = ref(1);
// Модератор — как поставщик и администратор — видит цену с учётом членского
// взноса (это то, что реально заплатит заказчик); заказчику в каталоге эта
// подпись не показывается.
const feePercent = ref(0);

// Убираем offer из ленты после решения (он сменил статус и пропал из очереди).
function removeFromList(offerId: string): void {
  items.value = items.value.filter((o) => o.id !== offerId);
  total.value = Math.max(0, total.value - 1);
}

// Диалоги + мутации модерации — общий feature-композабл (DRY со страницей
// предложения на столе администратора).
const { isApproving, isRejecting, confirmApprove, confirmReject } = useOfferModeration({
  onApproved: removeFromList,
  onRejected: removeFromList,
});

// Справочник категорий (id → название) — показываем прямо в карточке.
const categoryNames = ref<Record<number, string>>({});

const hasMore = computed(() => items.value.length < total.value);

// Название категории по offer'у (через справочник id → display_name).
function categoryName(offer: MarketplacePendingOfferView): string | null {
  const catId = offer.category_id != null ? Number(offer.category_id) : null;
  return catId != null ? categoryNames.value[catId] ?? null : null;
}

function toCatalogOffer(offer: MarketplacePendingOfferView): CatalogOffer {
  return {
    id: offer.id,
    title: offer.product_name,
    description: offer.description ?? undefined,
    images: marketplaceOfferImageUrls(offer.images),
    remainUnits: offer.unlimited_flag ? undefined : offer.quantity_available,
    unitCost: offer.price_per_unit,
    unitLabel: marketplaceOrderUnitLabel(offer.unit_of_measure),
    status: 'moderation',
    category: categoryName(offer) ?? undefined,
    supplierName: offer.supplier_name ?? offer.supplier_account ?? undefined,
  };
}

// Клик по карточке → полная карточка предложения на столе администратора
// (read-only маршрут, без перехода на стол заказчика). Модератор видит полное
// описание, участки поставки с объёмами и гарантию — то, что в карточке скрыто.
function goToDetail(offer: MarketplacePendingOfferView): void {
  void router.push({
    name: 'marketplace-admin-offer-detail',
    params: { coopname: String(route.params.coopname ?? ''), offerId: offer.id },
  });
}

async function loadCategories(): Promise<void> {
  try {
    const cats = await fetchCategories();
    const map: Record<number, string> = {};
    for (const c of cats) map[Number(c.id)] = c.display_name;
    categoryNames.value = map;
  } catch {
    // Справочник категорий не критичен для модерации — просто не покажем название.
  }
}

async function loadPage(append: boolean): Promise<void> {
  loading.value = true;
  try {
    const page = await fetchPendingOffers({
      page: currentPage.value,
      limit: PAGE_SIZE,
    });
    total.value = page.totalCount;
    items.value = append ? items.value.concat(page.items) : page.items;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function onLoadMore(): Promise<void> {
  if (!hasMore.value || loading.value) return;
  currentPage.value += 1;
  await loadPage(true);
}

// Realtime: поставщик подал/исправил предложение или второй модератор уже
// решил по нему — очередь обновляется сразу. Сигналы приходят в канал
// модерации (подключается только председателю). Сброс на первую страницу:
// очередь FIFO, новая заявка появляется в её хвосте, решённая — уходит.
const reloadLive = debounce(() => {
  if (loading.value) return;
  currentPage.value = 1;
  void loadPage(false);
}, 400);
useMarketplaceRealtime(
  { MarketplaceOfferModerationEvent: () => reloadLive() },
  { onResync: () => reloadLive() },
);

onMounted(async () => {
  await Promise.all([loadPage(false), loadCategories()]);
  try {
    feePercent.value = await getMembershipFeePercent();
  } catch {
    // Без ставки показываем карточки без цены с учётом взноса.
  }
});
</script>

<template lang="pug">
q-page.moderation(role="region", aria-label="Модерация предложений")
  PageHint(storage-key="mp:moderation:banner-dismissed")
    | Предложения поставщиков ожидают вашего одобрения. После «Одобрить» товар появится в публичном каталоге кооператива.

  .moderation__toolbar
    q-space
    span.chip.chip--warn
      q-icon(name="hourglass_empty", size="14px")
      | На модерации: {{ total }}

  //- Канон загрузки: скелетон, а не спиннер поверх.
  CardListSkeleton(v-if="loading && items.length === 0", :count="3")

  EmptyState(
    v-if="!loading && items.length === 0",
    title="Очередь модерации пуста",
    body="Все предложения поставщиков рассмотрены."
  )
    template(#icon)
      q-icon(name="check_circle", size="48px")

  q-infinite-scroll(@load="onLoadMore", :disable="!hasMore || loading")
    .row.q-col-gutter-md
      .col-12.col-sm-6.col-md-4.col-lg-3(v-for="o in items", :key="o.id")
        //- Клик по карточке открывает полную карточку предложения на столе
        //- администратора (категория/участки/гарантия/галерея). Кнопки
        //- «Одобрить»/«Отклонить» останавливают всплытие (@click.stop).
        CatalogOfferCard(:offer="toCatalogOffer(o)", :fee-percent="feePercent", @click="goToDetail(o)")
          template(#actions)
            BaseButton(
              variant="danger",
              size="sm",
              :loading="isRejecting(o.id)",
              @click.stop="confirmReject(o)"
            )
              template(#icon-left)
                q-icon(name="close", size="16px")
              | Отклонить
            BaseButton(
              variant="primary",
              size="sm",
              :loading="isApproving(o.id)",
              @click.stop="confirmApprove(o)"
            )
              template(#icon-left)
                q-icon(name="check", size="16px")
              | Одобрить
    template(#loading)
      .row.justify-center.q-my-md
        q-spinner(color="primary", size="2em")
</template>

<style scoped lang="scss">
.moderation {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__toolbar {
    display: flex;
    align-items: center;
  }
}

@media (max-width: 768px) {
  .moderation {
    padding: var(--p-4, 16px);
  }
}
</style>
