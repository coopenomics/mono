<template lang="pug">
.voting-page(:class='{ "voting-page--standalone": isStandaloneVoting }')
  WindowLoader(v-show='isInitialLoading', text='Загрузка данных голосования...')

  .voting-page__body(v-show='!isInitialLoading')
    .voting-page__nav(v-if='isStandaloneVoting')
      BaseButton(variant='ghost', size='sm', @click='goBack')
        template(#icon-left)
          q-icon(name='arrow_back')
        | К результатам

    EmptyState(
      v-if='!canShowVoting',
      title='Голосование ещё не началось',
      body='Голосование будет доступно после завершения работы над проектом. Следите за статусом на странице описания.'
    )
      template(#icon)
        q-icon(name='how_to_vote')

    template(v-else)
      //- Секция 1: контекст и сводка
      section.voting-page__section.voting-page__section--info
        .voting-page__panel.voting-page__panel--summary
          .voting-page__head(v-if='isStandaloneVoting && project')
            .voting-page__title-row
              h2.voting-page__title {{ project.title }}
              BaseBadge(:variant='statusVariant') {{ statusLabel }}
            .voting-page__parent.t-sm.t-muted(v-if='project.parent_title')
              q-icon(name='folder', size='14px')
              span {{ project.parent_title }}

          .voting-page__metrics(v-if='project && project.voting?.amounts')
            WalletCard(
              v-if='isStandaloneVoting || project.voting?.voting_deadline',
              compact,
              neutral,
              title='Голосование до',
              :balance='formatDeadline(project.voting?.voting_deadline)',
              symbol='',
              balance-label='срок',
              icon='event'
            )
            WalletCard(
              compact,
              neutral,
              title='На распределении',
              :balance='formatMoneyAmount(project.voting.amounts.total_voting_pool)',
              :symbol='governSymbol',
              balance-label='пул',
              icon='account_balance'
            )
            WalletCard(
              v-if='!isVotingCompleted(project)',
              compact,
              neutral,
              title='Голосующая сумма',
              :balance='formatMoneyAmount(project.voting.amounts.active_voting_amount)',
              :symbol='governSymbol',
              balance-label='ваш голос',
              icon='payments'
            )

      //- Секция 2: голосование / результаты — отдельная плоскость
      section.voting-page__section.voting-page__section--vote
        .voting-page__section-head
          .voting-page__section-label
            q-icon(name='how_to_vote', size='18px')
            span.t-eyebrow {{ voteSectionEyebrow }}
          h3.voting-page__section-title {{ voteSectionTitle }}
        .voting-page__panel
          ProjectVotingSegmentsWidget(
            :project-hash='projectHash',
            :coopname='info.coopname',
            :expanded='expandedSegments',
            :project='project || undefined',
            :current-username='username',
            :segments-to-reload='segmentsToReload',
            @toggle-expand='handleSegmentToggleExpand',
            @segment-click='handleSegmentClick',
            @data-loaded='handleSegmentsDataLoaded',
            @votes-changed='handleVotesChanged'
          )
            template(#segment-content='{ segment, segmentsToReload }')
              SegmentVotesWidget(
                :project-hash='projectHash',
                :coopname='info.coopname',
                :segment-username='segment.username',
                :segment-display-name='segment.display_name',
                :force-reload='segmentsToReload[segment.username]'
              )
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { useExpandableState, useDataPoller } from 'src/shared/lib/composables';
import { goBackOr } from 'src/shared/lib/navigation';
import { POLL_INTERVALS } from 'src/shared/lib/consts';
import { WindowLoader } from 'src/shared/ui/Loader';
import { EmptyState, BaseButton, BaseBadge } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import {
  ProjectVotingSegmentsWidget,
  SegmentVotesWidget,
} from 'app/extensions/capital/widgets';
import { useSessionStore } from 'src/entities/Session';
import { useProjectLoader } from 'app/extensions/capital/entities/Project/model';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { Zeus } from '@coopenomics/sdk';

const route = useRoute();
const router = useRouter();
const { info } = useSystemStore();
const { username } = useSessionStore();
const desktopStore = useDesktopStore();
const { project, projectHash, loadProject } = useProjectLoader();

/** Открыто со списка «Голосования», а не как вкладка компонента */
const isStandaloneVoting = computed(() => route.name === 'voting-detail');

const governSymbol = computed(
  () => info.symbols?.root_govern_symbol || 'RUB',
);

const canShowVoting = computed(() => {
  if (!project.value) return false;
  const status = String(project.value.status);
  return (
    status === Zeus.ProjectStatus.FINALIZED ||
    status === Zeus.ProjectStatus.RESULT ||
    status === Zeus.ProjectStatus.VOTING
  );
});

const isVotingCompleted = (proj: any) => {
  if (!proj) return false;
  const status = String(proj.status);
  const voting = proj.voting;
  if (status === Zeus.ProjectStatus.RESULT || status === 'RESULT') return true;
  if (voting && voting.votes_received === voting.total_voters) return true;
  return false;
};

const statusLabel = computed(() => {
  const status = String(project.value?.status || '');
  if (status === Zeus.ProjectStatus.VOTING) return 'Активно';
  if (status === Zeus.ProjectStatus.RESULT) return 'Завершено';
  return 'Неизвестно';
});

const statusVariant = computed<BaseBadgeVariant>(() => {
  const status = String(project.value?.status || '');
  if (status === Zeus.ProjectStatus.VOTING) return 'pos';
  if (status === Zeus.ProjectStatus.RESULT) return 'warn';
  return 'neutral';
});

const voteFinished = computed(() => isVotingCompleted(project.value));

const voteSectionEyebrow = computed(() =>
  voteFinished.value ? 'Итоги' : 'Участие',
);

const voteSectionTitle = computed(() =>
  voteFinished.value ? 'Результаты голосования' : 'Распределение голосов',
);

function formatDeadline(deadline?: string) {
  if (!deadline) return '—';
  try {
    const date = new Date(deadline);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return deadline;
  }
}

function formatMoneyAmount(raw: string | number | undefined): string {
  const src =
    typeof raw === 'string' && /\s[A-Z]{3,7}$/.test(raw.trim())
      ? raw
      : `${raw || 0} ${governSymbol.value}`;
  const formatted = formatAsset2Digits(src);
  return formatted.replace(/\s*[A-Z]{3,7}\s*$/, '').trim() || '0,00';
}

const goBack = () => {
  goBackOr(router, { name: 'results' });
};

const SEGMENTS_EXPANDED_KEY = 'capital_component_voting_segments_expanded';
const isInitialLoading = ref(true);
const segmentsToReload = ref<Record<string, number>>({});

const {
  expanded: expandedSegments,
  loadExpandedState: loadSegmentsExpandedState,
  cleanupExpandedByKeys: cleanupSegmentsExpanded,
  toggleExpanded: toggleSegmentExpanded,
} = useExpandableState(SEGMENTS_EXPANDED_KEY);

const handleSegmentToggleExpand = (uname: string) => {
  toggleSegmentExpanded(uname);
};

const handleSegmentsDataLoaded = (usernames: string[]) => {
  cleanupSegmentsExpanded(usernames);
  isInitialLoading.value = false;
};

const handleSegmentClick = (uname: string) => {
  toggleSegmentExpanded(uname);
};

const handleVotesChanged = (data: { projectHash: string; voter: string }) => {
  segmentsToReload.value[data.voter] = Date.now();
};

const reloadVotingData = async () => {
  try {
    const timestamp = Date.now();
    Object.keys(segmentsToReload.value).forEach((key) => {
      segmentsToReload.value[key] = timestamp;
    });
    if (Object.keys(segmentsToReload.value).length === 0) {
      segmentsToReload.value['__force_reload__'] = timestamp;
    }
  } catch (error) {
    console.warn('Ошибка при перезагрузке данных голосования в poll:', error);
  }
};

const { start: startVotingPoll, stop: stopVotingPoll } = useDataPoller(
  reloadVotingData,
  { interval: POLL_INTERVALS.FAST, immediate: false },
);

watch(
  () => project.value?.title,
  (title) => {
    if (isStandaloneVoting.value && title) {
      desktopStore.setPageTitleOverride(title);
    }
  },
  { immediate: true },
);

onMounted(async () => {
  await loadProject();
  loadSegmentsExpandedState();
  if (!canShowVoting.value) {
    isInitialLoading.value = false;
  }
  startVotingPoll();
});

onBeforeUnmount(() => {
  stopVotingPoll();
  if (isStandaloneVoting.value) {
    desktopStore.clearPageTitleOverride();
  }
});
</script>

<style lang="scss" scoped>
.voting-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
  background: var(--p-surface);
  min-width: 0;
  box-sizing: border-box;

  &--standalone {
    min-height: calc(100vh - var(--p-topbar-h));
  }
}

.voting-page__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-7);
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.voting-page__nav {
  display: flex;
  align-items: center;
}

.voting-page__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  min-width: 0;

  &--vote {
    gap: var(--p-3);
  }
}

.voting-page__section-head {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.voting-page__section-label {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  color: var(--p-ink-2);

  .q-icon {
    color: var(--p-primary);
  }
}

.voting-page__section-title {
  margin: 0;
  font-size: var(--p-fs-h4, 1.05rem);
  font-weight: 600;
  line-height: 1.3;
  color: var(--p-ink);
}

.voting-page__head {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}

.voting-page__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-2);
}

.voting-page__title {
  margin: 0;
  font-size: var(--p-fs-h3, 1.25rem);
  font-weight: 600;
  line-height: 1.3;
  color: var(--p-ink);
}

.voting-page__parent {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
}

.voting-page__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--p-3);
  align-items: stretch;

  :deep(.wallet) {
    height: 100%;
    box-sizing: border-box;
  }

  :deep(.wallet__body) {
    flex: 1 1 auto;
    flex-wrap: nowrap;
    min-width: 0;
  }

  :deep(.wallet__main) {
    flex: 1 1 auto;
    min-width: 0;
  }

  :deep(.wallet__amount) {
    flex-shrink: 0;
  }

  :deep(.wallet__metric-val) {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
}

.voting-page__panel {
  min-width: 0;
  padding: var(--p-2) var(--p-5);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);

  &--summary {
    display: flex;
    flex-direction: column;
    gap: var(--p-4);
    padding: var(--p-5);
  }
}

@media (max-width: 768px) {
  .voting-page {
    padding: var(--p-4);
  }

  .voting-page__body {
    gap: var(--p-5);
  }

  .voting-page__panel {
    padding: var(--p-1) var(--p-4);

    &--summary {
      padding: var(--p-4);
    }
  }
}
</style>
