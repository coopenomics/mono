<template lang="pug">
.contrib-history
  CardListSkeleton(v-if='firstLoad', :count='3')

  EmptyState(
    v-if='!firstLoad && !items.length',
    :title='$t("capital.contributionsHistoryWidget.emptyTitle")',
    :body='$t("capital.contributionsHistoryWidget.emptyBody")'
  )
    template(#icon)
      q-icon(name='savings', size='48px')

  //- Зоны записи: опознание — «каким взносом», деньги — «на сколько»,
  //- действие — открыть подробности. Состояния нет: в ленте только внесённое.
  .contrib-row(
    v-for='c in items',
    :key='c.id',
    role='button',
    tabindex='0',
    @click='open(c)',
    @keydown.enter='open(c)'
  )
    q-icon.contrib-row__icon(:name='kindOf(c).icon', size='20px')
    .contrib-row__identity
      .contrib-row__title {{ kindOf(c).label }}
      .contrib-row__meta {{ formatDate(c.created_at) }}
    .contrib-row__money
      .contrib-row__amount {{ formatAsset2Digits(c.amount) }}
      .contrib-row__caption {{ $t('capital.contributionsHistoryWidget.amountCaption') }}
    BaseButton(variant='secondary', size='sm', @click.stop='open(c)') {{ $t('capital.contributionsHistoryWidget.details') }}

  .row.justify-center(v-if='hasMore')
    BaseButton(variant='ghost', :loading='loading', @click='loadMore') {{ $t('capital.contributionsHistoryWidget.loadMore') }}

  DetailsDrawer(v-model='drawerOpen', :title='selected ? kindOf(selected).label : ""')
    .contrib-details(v-if='selected')
      div
        .contrib-details__eyebrow {{ $t('capital.contributionsHistoryWidget.amountCaption') }}
        .contrib-details__amount {{ formatAsset2Digits(selected.amount) }}
      DataRow(:label='$t("capital.contributionsHistoryWidget.dateLabel")', :value='formatDate(selected.created_at)', align='spread')
      DataRow(:label='$t("capital.contributionsHistoryWidget.operationLabel")', :value='selected.id', align='spread', mono)
      DataRow(v-if='selected.memo', :label='$t("capital.contributionsHistoryWidget.memoLabel")', :value='selected.memo', align='vertical')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Ledger2Contract } from 'cooptypes';
import { Zeus } from '@coopenomics/sdk';
import { BaseButton, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer } from 'src/shared/ui/domain';
import { FailAlert } from 'src/shared/api/alerts';
import { useFirstLoad } from 'src/shared/lib/composables';
import { liveTable, useLiveReload } from 'src/shared/lib/realtime';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { uiLocale } from 'src/shared/i18n';
import { useSessionStore } from 'src/entities/Session';
import { contributionApi, type IContribution, type IContributionsPage } from 'app/extensions/capital/entities/Contribution';
import { t } from '../../i18n';

const PAGE_SIZE = 20;
const Kind = Zeus.CapitalContributionKind;

const session = useSessionStore();
const items = ref<IContribution[]>([]);
const currentPage = ref(1);
const totalPages = ref(0);
// true до первого запроса: первый кадр показывает каркас, а не «пусто»
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const hasMore = computed(() => currentPage.value < totalPages.value);

const drawerOpen = ref(false);
const selected = ref<IContribution | null>(null);

const KIND_VIEW: Record<string, { label: string; icon: string }> = {
  [Kind.MONEY]: { label: t('capital.contributionsHistoryWidget.kind.money'), icon: 'payments' },
  [Kind.PROPERTY]: { label: t('capital.contributionsHistoryWidget.kind.property'), icon: 'inventory_2' },
  [Kind.RESULT]: { label: t('capital.contributionsHistoryWidget.kind.result'), icon: 'lightbulb' },
  [Kind.IMPORT]: { label: t('capital.contributionsHistoryWidget.kind.import'), icon: 'history' },
};

function kindOf(c: IContribution) {
  return KIND_VIEW[c.kind] ?? { label: c.kind, icon: 'savings' };
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(uiLocale());
}

function fetchPage(page: number): Promise<IContributionsPage> {
  return contributionApi.loadContributions({
    filter: { username: session.username },
    options: { page, limit: PAGE_SIZE, sortOrder: 'DESC' },
  });
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    // Дочитка по ленте перечитывает уже открытые страницы, а не сбрасывает список на первую.
    const pages = await Promise.all(Array.from({ length: currentPage.value }, (_, i) => fetchPage(i + 1)));
    items.value = pages.flatMap((p) => p.items);
    totalPages.value = pages[pages.length - 1]?.totalPages ?? 0;
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function loadMore(): Promise<void> {
  if (!hasMore.value || loading.value) return;
  currentPage.value += 1;
  await load();
}

function open(c: IContribution): void {
  selected.value = c;
  drawerOpen.value = true;
}

// Взнос внесён, когда прошла операция книги учёта — лента кошельков пайщика её и приносит.
const live = useLiveReload([liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets)], load);

onMounted(load);

defineExpose({ reload: () => live.refresh() });
</script>

<style scoped lang="scss">
.contrib-history {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.contrib-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--p-6);
  padding: var(--p-4) var(--p-5);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg);
  background: var(--p-surface);
  cursor: pointer;

  &:hover {
    border-color: var(--p-line-2);
  }

  &__icon {
    color: var(--p-ink-2);
  }

  &__title {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__meta,
  &__caption {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }

  &__money {
    text-align: right;
  }

  &__amount {
    font-size: var(--p-fs-h2);
    font-weight: 700;
    color: var(--p-ink);
    white-space: nowrap;
  }
}

.contrib-details {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);

  &__eyebrow {
    font-size: var(--p-fs-eyebrow);
    color: var(--p-ink-3);
  }

  &__amount {
    font-size: var(--p-fs-h2);
    font-weight: 700;
    color: var(--p-ink);
  }
}

@media (max-width: 768px) {
  .contrib-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: var(--p-3);

    .base-btn {
      display: none;
    }
  }
}
</style>
