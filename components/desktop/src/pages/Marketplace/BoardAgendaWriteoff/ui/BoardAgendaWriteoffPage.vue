<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Notify } from 'quasar';
import {
  listWriteoffProposals,
  type MarketplaceWriteoffProposalsPageView,
} from '../../AdminWriteoffs/api';
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
 * Polling 30s — статусы меняются по решению совета (core sov-flow).
 */

type WriteoffStatus = 'ON_AGENDA' | 'AUTHORIZED' | 'EXECUTING' | 'EXECUTED' | 'REJECTED';

const POLL_INTERVAL_MS = 30_000;
const BOARD_STATUSES: WriteoffStatus[] = [
  'ON_AGENDA',
  'AUTHORIZED',
  'EXECUTING',
  'EXECUTED',
  'REJECTED',
];

const STATUS_LABEL: Record<WriteoffStatus, string> = {
  ON_AGENDA: 'На повестке',
  AUTHORIZED: 'Одобрено',
  EXECUTING: 'Исполняется',
  EXECUTED: 'Исполнено',
  REJECTED: 'Отклонено',
};

const STATUS_COLOR: Record<WriteoffStatus, string> = {
  ON_AGENDA: 'warning',
  AUTHORIZED: 'positive',
  EXECUTING: 'info',
  EXECUTED: 'positive',
  REJECTED: 'negative',
};

const page = ref<MarketplaceWriteoffProposalsPageView | null>(null);
const loading = ref(false);
const statusFilter = ref<WriteoffStatus | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const items = computed(() => page.value?.items ?? []);
const total = computed(() => page.value?.totalCount ?? 0);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const statuses = (statusFilter.value ? [statusFilter.value] : BOARD_STATUSES) as never;
    page.value = await listWriteoffProposals(
      { statuses },
      { page: 1, limit: 100 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
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

onMounted(async () => {
  await load();
  pollTimer = setInterval(() => {
    void load();
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
q-page.mp-role-admin.mp-board-writeoff(role="region", aria-label="Повестка совета — списания")
  div.mp-board-writeoff__header
    div
      div.text-h5 Повестка совета — проекты списания
      div.text-caption.mp-board-writeoff__subtitle
        | Проекты списания скоропорта, отправленные администратором в совет. Голосование совета проходит на core soviet agenda; здесь — обзор статусов и принятых решений.
    q-space
    q-btn(flat, dense, round, icon="fa-solid fa-rotate", :loading="loading", @click="load", aria-label="Обновить")

  q-tabs.mp-board-writeoff__tabs(
    :model-value="statusFilter",
    inline-label,
    align="left",
    dense,
    no-caps,
    @update:model-value="changeFilter"
  )
    q-tab(:name="null", label="Все")
    q-tab(name="ON_AGENDA", label="На повестке")
    q-tab(name="AUTHORIZED", label="Одобрены")
    q-tab(name="EXECUTING", label="Исполняются")
    q-tab(name="EXECUTED", label="Исполнены")
    q-tab(name="REJECTED", label="Отклонены")

  q-inner-loading(:showing="loading && items.length === 0")
    q-spinner(color="primary", size="2em")

  div.mp-board-writeoff__empty(v-if="!loading && items.length === 0")
    q-icon(name="fa-solid fa-clipboard-check", size="48px", color="grey-5")
    div.text-subtitle1.q-mt-md Совет ещё не получал проектов списания
    div.text-caption Когда администратор отправит проект в совет, он появится здесь.

  q-card(v-if="items.length > 0", flat, bordered)
    q-list(separator)
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
          q-chip(
            :color="STATUS_COLOR[p.status]",
            text-color="white",
            square,
            dense
          )
            | {{ STATUS_LABEL[p.status] }}

  div.mp-board-writeoff__counter
    | Всего на повестке: {{ total }}
</template>

<style scoped lang="scss">
.mp-board-writeoff {
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

  &__counter {
    color: var(--mp-on-surface-muted);
    text-align: right;
    margin-top: var(--mp-space-xs);
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--mp-space-xl) 0;
    color: var(--mp-on-surface-muted);
  }
}
</style>
