<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert } from 'src/shared/api';
import {
  listWriteoffProposals,
  type MarketplaceWriteoffProposalsPageView,
} from '../../AdminWriteoffs/api';
import { BaseBadge, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { useMarketplaceRealtime } from 'src/shared/lib/marketplace';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

/**
 * Эпик 8 / Story 8.x: read-only лента писеof проектов для совета.
 *
 * Совет видит проекты в активных статусах (ON_AGENDA / AUTHORIZED /
 * EXECUTING / EXECUTED / REJECTED). DRAFT'ы скрыты — это рабочая зона
 * админа на странице «Проекты списания». Само голосование совета
 * подключается через core soviet agenda (sov-flow), здесь только обзор.
 *
 * Backend: Queries.Marketplace.ListWriteoffProposals.
 * Reuse helper listWriteoffProposals из AdminWriteoffs/api.
 *
 * Live-обновления — realtime: переход проекта списания (в повестку,
 * авторизован, исполнен, отклонён) приходит сигналом в канал совета.
 */

type WriteoffStatus = 'ON_AGENDA' | 'AUTHORIZED' | 'EXECUTING' | 'EXECUTED' | 'REJECTED';

const BOARD_STATUSES: WriteoffStatus[] = [
  'ON_AGENDA',
  'AUTHORIZED',
  'EXECUTING',
  'EXECUTED',
  'REJECTED',
];

// Локальный WriteoffStatus — строковый union (5 видимых совету статусов).
// SDK-вход statuses ждёт enum MarketplaceWriteoffProposalStatus — маппим через
// явную таблицу, чтобы не кастовать и не плодить DRAFT в records/шаблоне.
const STATUS_TO_ENUM: Record<WriteoffStatus, Zeus.MarketplaceWriteoffProposalStatus> = {
  ON_AGENDA: Zeus.MarketplaceWriteoffProposalStatus.ON_AGENDA,
  AUTHORIZED: Zeus.MarketplaceWriteoffProposalStatus.AUTHORIZED,
  EXECUTING: Zeus.MarketplaceWriteoffProposalStatus.EXECUTING,
  EXECUTED: Zeus.MarketplaceWriteoffProposalStatus.EXECUTED,
  REJECTED: Zeus.MarketplaceWriteoffProposalStatus.REJECTED,
};

const STATUS_LABEL: Record<WriteoffStatus, string> = {
  ON_AGENDA: 'На повестке',
  AUTHORIZED: 'Одобрено',
  EXECUTING: 'Исполняется',
  EXECUTED: 'Исполнено',
  REJECTED: 'Отклонено',
};

const STATUS_VARIANT: Record<WriteoffStatus, BaseBadgeVariant> = {
  ON_AGENDA: 'warn',
  AUTHORIZED: 'pos',
  EXECUTING: 'info',
  EXECUTED: 'pos',
  REJECTED: 'neg',
};

// Чипы фильтра статусов (single-select). null — «Все».
const STATUS_TABS: { value: WriteoffStatus; label: string }[] = [
  { value: 'ON_AGENDA', label: 'На повестке' },
  { value: 'AUTHORIZED', label: 'Одобрены' },
  { value: 'EXECUTING', label: 'Исполняются' },
  { value: 'EXECUTED', label: 'Исполнены' },
  { value: 'REJECTED', label: 'Отклонены' },
];

const page = ref<MarketplaceWriteoffProposalsPageView | null>(null);
const loading = ref(false);
const statusFilter = ref<WriteoffStatus | null>(null);

const items = computed(() => page.value?.items ?? []);
const total = computed(() => page.value?.totalCount ?? 0);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const selected = statusFilter.value ? [statusFilter.value] : BOARD_STATUSES;
    const statuses = selected.map((s) => STATUS_TO_ENUM[s]);
    page.value = await listWriteoffProposals(
      { statuses },
      { page: 1, limit: 100 },
    );
  } catch (e) {
    FailAlert(e, 'Не удалось загрузить проекты списания');
  } finally {
    loading.value = false;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('ru-RU');
}

function changeFilter(value: WriteoffStatus | null): void {
  statusFilter.value = value;
  void load();
}

// Realtime вместо поллинга: статусы двигают cron и совет — сигнал приходит
// в канал совета, лента перечитывается сразу.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useMarketplaceRealtime(
  { MarketplaceWriteoffStatusChangedEvent: () => reloadLive() },
  { onResync: () => reloadLive() },
);

onMounted(async () => {
  await load();
});
</script>

<template lang="pug">
q-page.board-writeoff(role="region", aria-label="Повестка совета — списания")
  PageHint(storage-key="mp:board-writeoff:banner-dismissed")
    | Проекты списания скоропорта, отправленные администратором в совет. Голосование совета проходит на повестке совета; здесь — обзор статусов и принятых решений.

  .board-writeoff__toolbar
    .board-writeoff__chips(role="tablist", aria-label="Фильтр по статусу")
      .chip(
        :class="statusFilter === null ? 'chip--accent' : 'chip--neutral'",
        role="tab",
        :aria-selected="statusFilter === null",
        tabindex="0",
        @click="changeFilter(null)",
        @keydown.enter="changeFilter(null)"
      ) Все
      .chip(
        v-for="opt in STATUS_TABS",
        :key="opt.value",
        :class="statusFilter === opt.value ? 'chip--accent' : 'chip--neutral'",
        role="tab",
        :aria-selected="statusFilter === opt.value",
        tabindex="0",
        @click="changeFilter(opt.value)",
        @keydown.enter="changeFilter(opt.value)"
      ) {{ opt.label }}

  //- Канон загрузки: скелетон, а не спиннер поверх.
  CardListSkeleton(v-if="loading && items.length === 0", :count="3")

  EmptyState(
    v-if="!loading && items.length === 0",
    title="Совет ещё не получал проектов списания",
    body="Когда администратор отправит проект в совет, он появится здесь."
  )
    template(#icon)
      q-icon(name="fact_check", size="48px")

  q-list(v-if="items.length > 0", bordered, separator)
    q-item(v-for="p in items", :key="p.id")
      q-item-section
        q-item-label
          | Проект № {{ p.id.slice(0, 8) }}
          | — позиций: {{ p.items?.length ?? 0 }}
        q-item-label(caption)
          | Создан: {{ formatDate(p.created_at) }}
          | / Триггер: {{ p.trigger }}
          | / Сумма списания:
          | {{ p.total_amount ? formatAsset2Digits(p.total_amount) : '—' }}
      q-item-section(side, top)
        BaseBadge(:variant="STATUS_VARIANT[p.status]") {{ STATUS_LABEL[p.status] }}

  .t-muted.board-writeoff__counter Всего на повестке: {{ total }}
</template>

<style scoped lang="scss">
.board-writeoff {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);

  &__toolbar {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
    flex-wrap: wrap;
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--p-2, 8px);

    .chip {
      cursor: pointer;
      user-select: none;
      height: 28px;
      padding: 0 12px;
    }
  }

  &__counter {
    text-align: right;
    margin-top: var(--p-1, 4px);
  }
}

@media (max-width: 768px) {
  .board-writeoff {
    padding: var(--p-4, 16px);
  }
}
</style>
