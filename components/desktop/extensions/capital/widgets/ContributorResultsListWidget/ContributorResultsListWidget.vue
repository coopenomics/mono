<template lang="pug">
.contrib-results
  .contrib-results__skel(v-if='loading && !rows.length')
    .skel(v-for='i in 3', :key='i')

  EmptyState(
    v-else-if='!loading && !rows.length',
    :title='emptyTitle',
    :body='emptyBody'
  )
    template(#icon)
      q-icon(name='assignment_turned_in')

  .contrib-results__items(v-else)
    .contrib-results__item(v-for='row in rows', :key='rowKey(row)')
      .contrib-results__row
        ExpandToggleButton(
          :expanded='!!expanded[rowKey(row)]',
          @click='toggleExpanded(rowKey(row))'
        )

        .contrib-results__main
          .contrib-results__title-row
            span.contrib-results__title {{ row.project_title || 'Компонент' }}
            BaseBadge(:variant='getSegmentStatusVariant(row)')
              | {{ getSegmentShortStatus(row) }}
            BaseBadge(v-if='ownerAction(row) === "vote"', variant='warn') Требуется голос

          .contrib-results__sub(v-if='row.parent_title')
            q-icon(name='folder', size='14px')
            span.t-sm.t-muted {{ row.parent_title }}

          .contrib-results__owner(v-if='showOwner')
            q-icon(name='person', size='14px')
            span.t-sm.t-muted {{ row.display_name || row.username }}

          .contrib-results__metrics
            .contrib-results__metric
              span.t-sm.t-muted {{ showOwner ? 'Доля участника' : 'Моя доля' }}
              span.t-mono {{ formatMoney(row.intellectual_cost) }}
            .contrib-results__metric
              span.t-sm.t-muted Доля в объекте
              span.t-mono {{ Number(row.share_percent || 0).toFixed(2) }}%

        .contrib-results__side
          ResultSubmissionActionsWidget(:segment='row')
          BaseButton(
            v-if='ownerAction(row) === "vote"',
            variant='primary',
            size='sm',
            @click='toggleVoting(row)'
          )
            template(#icon-left)
              q-icon(name='how_to_vote', size='16px')
            | {{ votingOpen[rowKey(row)] ? 'Свернуть голосование' : 'Голосовать' }}

      //- Голосование прямо в строке: пайщику незачем искать себя внутри проекта
      .contrib-results__panel(v-if='votingOpen[rowKey(row)]')
        .contrib-results__panel-loading(v-if='!votingProjects[row.project_hash]')
          q-spinner(color='primary', size='24px')
          span.t-sm.t-muted Загружаем голосование…
        ProjectVotingSegmentsWidget(
          v-else,
          :project-hash='row.project_hash',
          :coopname='coopname',
          :expanded='votingExpanded',
          :project='votingProjects[row.project_hash]',
          :current-username='currentUsername',
          :segments-to-reload='segmentsToReload',
          @toggle-expand='toggleVotingSegment',
          @segment-click='toggleVotingSegment',
          @votes-changed='handleVotesChanged'
        )

      .contrib-results__panel(v-if='expanded[rowKey(row)]')
        SegmentResultInfoWidget(:segment='row')
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { EmptyState, BaseBadge, BaseButton } from 'src/shared/ui/base';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { api as ProjectApi } from 'app/extensions/capital/entities/Project/api';
import {
  getSegmentShortStatus,
  getSegmentStatusVariant,
  getSegmentOwnerAction,
} from 'app/extensions/capital/shared/lib/segmentStatus';
import { SegmentResultInfoWidget } from '../SegmentResultInfoWidget';
import { ResultSubmissionActionsWidget } from '../ResultSubmissionActionsWidget';
import { ProjectVotingSegmentsWidget } from '../ProjectVotingSegmentsWidget';

interface Props {
  rows: ISegment[];
  coopname: string;
  currentUsername: string;
  loading?: boolean;
  emptyTitle: string;
  emptyBody: string;
  /** Список чужих долей (стол председателя) — тогда в строке видно, чья это доля */
  showOwner?: boolean;
}

interface Emits {
  (e: 'updated'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const { info } = useSystemStore();

const expanded = ref<Record<string, boolean>>({});
const votingOpen = ref<Record<string, boolean>>({});
const votingProjects = ref<Record<string, IProject>>({});
const votingExpanded = ref<Record<string, boolean>>({});
const segmentsToReload = ref<Record<string, number>>({});

const governSymbol = computed(() => info.symbols?.root_govern_symbol || 'RUB');

/** Ключ строки: одна доля — это пара «проект + участник» */
const rowKey = (segment: ISegment) => `${segment.project_hash}_${segment.username}`;

const ownerAction = (segment: ISegment) => getSegmentOwnerAction(segment);

const formatMoney = (raw?: string | null) => {
  const value = parseFloat(String(raw || '0'));
  return formatAsset2Digits(`${value} ${governSymbol.value}`);
};

const toggleExpanded = (key: string) => {
  expanded.value[key] = !expanded.value[key];
};

const toggleVoting = async (segment: ISegment) => {
  const key = rowKey(segment);
  const open = !votingOpen.value[key];
  votingOpen.value[key] = open;
  if (!open) return;

  const projectHash = segment.project_hash;
  if (votingProjects.value[projectHash]) return;

  try {
    // Проект читается напрямую, минуя список мастерской: подмешивание одиночного
    // проекта в общий список сбивало бы порядок строк на этой же странице
    const project = await ProjectApi.loadProject({ hash: projectHash });
    if (project) {
      votingProjects.value[projectHash] = project as IProject;
    }
  } catch (error) {
    console.error('Ошибка при загрузке проекта для голосования:', error);
    FailAlert('Не удалось загрузить данные голосования');
    votingOpen.value[key] = false;
  }
};

const toggleVotingSegment = (username: string) => {
  votingExpanded.value[username] = !votingExpanded.value[username];
};

const handleVotesChanged = (data: { projectHash: string; voter: string }) => {
  segmentsToReload.value[data.voter] = Date.now();
  emit('updated');
};

</script>

<style lang="scss" scoped>
.contrib-results {
  min-width: 0;
}

.contrib-results__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);

  .skel {
    height: 84px;
    border-radius: var(--p-r-md);
  }
}

.contrib-results__items {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.contrib-results__item {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
  min-width: 0;
}

.contrib-results__row {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3);
  padding: var(--p-4) var(--p-5);
  min-width: 0;
}

.contrib-results__main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.contrib-results__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-2);
  min-width: 0;
}

.contrib-results__title {
  font-weight: 600;
  font-size: var(--p-fs-body);
  color: var(--p-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.contrib-results__sub,
.contrib-results__owner {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  min-width: 0;

  .q-icon {
    flex-shrink: 0;
    color: var(--p-ink-3);
  }
}

.contrib-results__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2) var(--p-6);
  padding-top: var(--p-2);
}

.contrib-results__metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 120px;

  .t-mono {
    font-weight: 600;
    color: var(--p-ink);
  }
}

.contrib-results__side {
  flex: 0 1 280px;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--p-2);
}

.contrib-results__panel {
  padding: 0 var(--p-5) var(--p-4) var(--p-8);
  min-width: 0;
}

.contrib-results__panel-loading {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  padding: var(--p-3) 0;
}

@media (max-width: 640px) {
  .contrib-results__row {
    flex-wrap: wrap;
    padding: var(--p-3) var(--p-4);
  }

  .contrib-results__side {
    flex: 1 1 100%;
    align-items: stretch;
    min-width: 0;
  }

  .contrib-results__panel {
    padding: 0 var(--p-4) var(--p-4);
  }
}
</style>
