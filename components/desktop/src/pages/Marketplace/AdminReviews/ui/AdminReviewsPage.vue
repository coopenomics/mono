<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { useRoute } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { t } from 'src/shared/i18n';
import { marketLiveTables } from 'src/shared/lib/marketplace';
import { useQueryOverlay } from 'src/shared/lib/navigation';
import { useLiveReload } from 'src/shared/lib/realtime';
import { formatDateToLocalTimezone } from 'src/shared/lib/utils/dates/timezone';
import {
  BaseBadge,
  BaseButton,
  BaseTable,
  EmptyState,
  TablePager,
  type BaseBadgeVariant,
  type BaseTableColumn,
} from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, FilterBar, PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import {
  listReviews,
  setReviewStatus,
  type MarketplaceReviewView,
} from 'src/entities/MarketplaceReview';
import { ReviewHideDialog } from 'src/widgets/Marketplace/ReviewHideDialog';

/**
 * Реестр отзывов на столе администратора: все отзывы кооператива, в том числе
 * скрытые. Строка открывает отзыв целиком в правой панели; там же его скрывают
 * с причиной либо возвращают в публикацию.
 */
const PAGE_SIZE = 20;

type StatusTab = 'all' | 'published' | 'hidden';

const STATUS_BY_TAB: Record<StatusTab, Zeus.MarketplaceReviewStatus | null> = {
  all: null,
  published: Zeus.MarketplaceReviewStatus.PUBLISHED,
  hidden: Zeus.MarketplaceReviewStatus.HIDDEN,
};

const STATUS_VIEW: Record<Zeus.MarketplaceReviewStatus, { label: string; variant: BaseBadgeVariant }> = {
  [Zeus.MarketplaceReviewStatus.PUBLISHED]: { label: t('marketplace.adminReviewsPage.status.published'), variant: 'pos' },
  [Zeus.MarketplaceReviewStatus.HIDDEN]: { label: t('marketplace.adminReviewsPage.status.hidden'), variant: 'neutral' },
};

const route = useRoute();
const coopname = computed(() => String(route.params.coopname ?? ''));
const overlay = useQueryOverlay('review');

const items = ref<MarketplaceReviewView[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const activeTab = ref<StatusTab>('all');
const search = ref('');
const acting = ref(false);
const hideOpen = ref(false);

const tabs = computed<PageTab[]>(() => [
  { key: 'all', label: t('marketplace.adminReviewsPage.tab.all') },
  { key: 'published', label: t('marketplace.adminReviewsPage.tab.published') },
  { key: 'hidden', label: t('marketplace.adminReviewsPage.tab.hidden') },
]);

const columns = computed<BaseTableColumn<MarketplaceReviewView>[]>(() => [
  { key: 'created_at', label: t('marketplace.adminReviewsPage.column.date'), width: '110px', nowrap: true },
  { key: 'offer', label: t('marketplace.adminReviewsPage.column.offer') },
  { key: 'author', label: t('marketplace.adminReviewsPage.column.author') },
  { key: 'stars', label: t('marketplace.adminReviewsPage.column.stars'), width: '120px', nowrap: true },
  { key: 'text', label: t('marketplace.adminReviewsPage.column.text') },
  { key: 'status', label: t('marketplace.adminReviewsPage.column.status'), width: '140px', nowrap: true },
]);

const selected = computed<MarketplaceReviewView | null>(
  () => items.value.find((review) => review.id === overlay.value.value) ?? null,
);
const drawerOpen = computed(() => overlay.isOpen.value && selected.value !== null);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const result = await listReviews(
      { include_hidden: true, status: STATUS_BY_TAB[activeTab.value], search: search.value.trim() || null },
      { page: page.value, limit: PAGE_SIZE, sortBy: 'created_at', sortOrder: 'DESC' },
    );
    items.value = result.items;
    total.value = result.totalCount;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function onSelectTab(tab: PageTab): void {
  activeTab.value = tab.key as StatusTab;
  page.value = 1;
  void load();
}

function onSearch(value: string): void {
  search.value = value;
  page.value = 1;
  void load();
}

function onPage(value: number): void {
  page.value = value;
  void load();
}

function formatDate(value: unknown): string {
  return formatDateToLocalTimezone(value, 'DD.MM.YYYY');
}

function shortText(text: string): string {
  return text.length > 140 ? `${text.slice(0, 140).trimEnd()}…` : text;
}

async function publish(review: MarketplaceReviewView): Promise<void> {
  if (acting.value) return;
  acting.value = true;
  try {
    await setReviewStatus({ id: review.id, status: Zeus.MarketplaceReviewStatus.PUBLISHED });
    SuccessAlert(t('marketplace.adminReviewsPage.publishedNotice'));
    await load();
  } catch (e) {
    FailAlert(e);
  } finally {
    acting.value = false;
  }
}

const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useLiveReload(marketLiveTables('review'), () => reloadLive());

onMounted(load);
</script>

<template lang="pug">
q-page.mp-role-admin.admin-reviews(role="region", :aria-label="$t('marketplace.adminReviewsPage.ariaLabel')")
  PageHint(storage-key="mp:admin-reviews:banner-dismissed")
    | {{ $t('marketplace.adminReviewsPage.hint') }}

  PageTabs(:tabs="tabs", :active-key="activeTab", @select="onSelectTab")

  FilterBar(
    :search="search",
    :search-placeholder="$t('marketplace.adminReviewsPage.searchPlaceholder')",
    hide-reset,
    @update:search="onSearch"
  )

  BaseTable(
    v-if="loading || items.length",
    :columns="columns",
    :rows="items",
    row-key="id",
    hover,
    :loading="loading",
    min-width="960px",
    clickable-rows,
    @row-click="(row) => overlay.open(row.id)"
  )
    template(#cell-created_at="{ row }")
      | {{ formatDate(row.created_at) }}
    template(#cell-offer="{ row }")
      | {{ row.offer_name || '—' }}
    template(#cell-author="{ row }")
      | {{ row.author_name || row.author_account }}
    template(#cell-stars="{ row }")
      q-rating(:model-value="row.stars", readonly, :max="5", size="16px", color="accent", icon="star_border", icon-selected="star")
    template(#cell-text="{ row }")
      | {{ row.text ? shortText(row.text) : '—' }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="STATUS_VIEW[row.status].variant") {{ STATUS_VIEW[row.status].label }}

  EmptyState(
    v-else,
    :title="$t('marketplace.adminReviewsPage.emptyTitle')",
    :body="$t('marketplace.adminReviewsPage.emptyBody')"
  )
    template(#icon)
      q-icon(name="rate_review", size="48px")

  TablePager(
    v-if="total > PAGE_SIZE",
    :page="page",
    :rows-per-page="PAGE_SIZE",
    :rows-number="total",
    :label="$t('marketplace.adminReviewsPage.pagerLabel')",
    @update:page="onPage"
  )

  //- Отзыв целиком — в правой панели (?review= в адресе): состояние, оценка,
  //- текст, кто и о чём; действия внизу панели.
  DetailsDrawer(
    :model-value="drawerOpen",
    :width="520",
    :title="$t('marketplace.adminReviewsPage.drawerTitle')",
    @update:model-value="(v) => !v && overlay.close()"
  )
    .admin-reviews__detail(v-if="selected")
      .admin-reviews__detail-head
        BaseBadge(:variant="STATUS_VIEW[selected.status].variant") {{ STATUS_VIEW[selected.status].label }}
        q-rating(:model-value="selected.stars", readonly, :max="5", size="20px", color="accent", icon="star_border", icon-selected="star")
      .admin-reviews__detail-text(v-if="selected.text") {{ selected.text }}
      DataRow(
        v-if="selected.hidden_reason",
        :label="$t('marketplace.adminReviewsPage.hiddenReasonLabel')",
        :value="selected.hidden_reason",
        align="vertical"
      )
      DataRow(:label="$t('marketplace.adminReviewsPage.column.date')", :value="formatDate(selected.created_at)")
      DataRow(:label="$t('marketplace.adminReviewsPage.column.author')", :value="selected.author_name || selected.author_account")
      DataRow(:label="$t('marketplace.adminReviewsPage.column.offer')")
        template(#value-override)
          router-link.admin-reviews__link(
            :to="{ name: 'marketplace-admin-offer-detail', params: { coopname, offerId: selected.offer_id }, query: { from: 'reviews' } }"
          ) {{ selected.offer_name || selected.offer_id }}
      DataRow(:label="$t('marketplace.adminReviewsPage.supplierLabel')")
        template(#value-override)
          router-link.admin-reviews__link(
            :to="{ name: 'marketplace-admin-supplier-profile', params: { coopname, account: selected.supplier_account } }"
          ) {{ selected.supplier_account }}
    template(#footer)
      template(v-if="selected")
        BaseButton(
          v-if="selected.status === Zeus.MarketplaceReviewStatus.PUBLISHED",
          variant="danger",
          @click="hideOpen = true"
        ) {{ $t('marketplace.adminReviewsPage.hideAction') }}
        BaseButton(v-else, variant="primary", :loading="acting", @click="publish(selected)") {{ $t('marketplace.adminReviewsPage.publishAction') }}

  ReviewHideDialog(v-model="hideOpen", :review="selected", @saved="load")
</template>

<style scoped lang="scss">
.admin-reviews {
  padding: var(--p-6);
  display: flex;
  flex-direction: column;
  gap: var(--p-4);

  &__detail {
    display: flex;
    flex-direction: column;
    gap: var(--p-3);
  }

  &__detail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3);
  }

  &__detail-text {
    color: var(--p-ink);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  &__link {
    color: var(--p-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

@media (max-width: 768px) {
  .admin-reviews {
    padding: var(--p-4);
  }
}
</style>
