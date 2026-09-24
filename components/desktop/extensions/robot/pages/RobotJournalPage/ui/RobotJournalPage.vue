<template lang="pug">
.q-pa-md
  .banner.banner--info.q-mb-md(v-if='!dismissed')
    q-icon.banner__icon(name='info', size='20px')
    .banner__body
      | {{ $t('robot.robotJournalPage.bannerLine1') }}
      | {{ $t('robot.robotJournalPage.bannerLine2') }}
    button.icon-btn(type='button', :aria-label='$t("robot.robotJournalPage.hideAriaLabel")', @click='dismiss')
      q-icon(name='close')

  BaseTable(
    :columns='columns',
    :rows='items',
    row-key='id',
    :loading='loading && !items.length',
    min-width='960px'
  )
    template(#cell-decision='{ row }')
      .doc-primary №{{ row.decision_id }} · {{ typeTitle(row.decision_type) }}
      .t-sm.t-muted {{ formatDate(row.created_at) }}
    template(#cell-stage='{ row }')
      BaseBadge(:variant='stageMeta(row.stage).variant') {{ stageMeta(row.stage).label }}
      .t-sm.t-muted(v-if='row.waiting_for.length') {{ $t('robot.robotJournalPage.waitingForText', { members: row.waiting_for.map(robotStore.shortMemberName).join(', ') }) }}
    template(#cell-votes='{ row }')
      template(v-if='row.votes.length')
        div(v-for='vote in row.votes', :key='vote.member') {{ robotStore.shortMemberName(vote.member) }}
      span.t-muted(v-else) —
    template(#cell-tx='{ row }')
      div.t-mono-sm(v-for='tx in row.tx_hashes', :key='tx') {{ shortHash(tx) }}
      span.t-muted(v-if='!row.tx_hashes.length') —
    template(#cell-error='{ row }')
      span.text-negative(v-if='row.last_error') {{ row.last_error }}
      span.t-muted(v-else) —
    template(#footer)
      .row.items-center.justify-between.q-pa-sm
        .t-sm.t-muted {{ $t('robot.robotJournalPage.pageOfText', { page, total: totalPages }) }}
        .row.q-gutter-sm
          BaseButton(variant='ghost', size='sm', :disabled='page <= 1 || loading', @click='goTo(page - 1)') {{ $t('common.action.back') }}
          BaseButton(variant='ghost', size='sm', :disabled='page >= totalPages || loading', @click='goTo(page + 1)') {{ $t('robot.robotJournalPage.forwardButton') }}
  EmptyState(
    v-if='!loading && !items.length',
    :title='$t("robot.robotJournalPage.emptyTitle")',
    :body='$t("robot.robotJournalPage.emptyBody")'
  )
    template(#icon)
      q-icon(name='smart_toy', size='48px')
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { uiLocale } from 'src/shared/i18n';
import { useDismissibleBanner } from 'src/shared/hooks/useDismissibleBanner';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base';
import { useRobotStore } from '../../../entities/robot';
import type { IRobotDecision } from '../../../entities/robot';
import { robotStageMeta } from '../../../shared/stage';
import { t } from '../../../i18n';

const robotStore = useRobotStore();
const { dismissed, dismiss } = useDismissibleBanner('robot:journal:banner-dismissed');

const loading = ref(true);
const page = ref(1);
const limit = 20;
let refreshTimer: ReturnType<typeof setInterval> | undefined;

const items = computed<IRobotDecision[]>(() => robotStore.journal?.items ?? []);
const totalPages = computed(() => robotStore.journal?.totalPages ?? 1);

const columns: BaseTableColumn<IRobotDecision>[] = [
  { key: 'decision', label: t('robot.robotJournalPage.decisionColumn') },
  { key: 'stage', label: t('robot.robotJournalPage.stageColumn'), width: '170px' },
  { key: 'votes', label: t('robot.robotJournalPage.votesColumn'), width: '160px' },
  { key: 'tx', label: t('robot.robotJournalPage.txColumn'), width: '150px' },
  { key: 'error', label: t('robot.robotJournalPage.errorColumn') },
];

function typeTitle(type: string): string {
  return robotStore.titleByType[type] ?? type;
}

function stageMeta(stage: IRobotDecision['stage']) {
  return robotStageMeta(stage);
}

function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
}

function formatDate(value: string | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(uiLocale());
}

async function load(silent = false) {
  if (!silent) loading.value = true;
  try {
    await robotStore.loadJournal({ options: { page: page.value, limit, sortBy: 'decision_id', sortOrder: 'DESC' } });
  } catch (e: unknown) {
    if (!silent) FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function goTo(next: number) {
  page.value = next;
  await load();
}

onMounted(async () => {
  try {
    // Состав совета нужен, чтобы показывать ФИО вместо учётных имён.
    if (!robotStore.council) await robotStore.loadCouncil();
    if (!robotStore.registry.length) await robotStore.loadRegistry();
  } catch {
    // названия типов — украшение; журнал читается и без них
  }
  await load();
  // журнал живёт секундами — обновляем молча, без спиннера
  refreshTimer = setInterval(() => void load(true), 10000);
});

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>
