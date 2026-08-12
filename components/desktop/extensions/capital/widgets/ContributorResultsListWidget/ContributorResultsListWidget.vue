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
        .contrib-results__main
          .contrib-results__title-row
            button.contrib-results__title(
              type='button',
              @click='navigateToComponent(row.project_hash)'
            ) {{ row.project_title || 'Компонент' }}
            BaseBadge(:variant='badge(row).variant')
              | {{ badge(row).label }}
              q-tooltip {{ badge(row).hint }}

          .contrib-results__path
            q-icon(name='folder', size='14px')
            button.contrib-results__parent.t-sm(
              v-if='row.parent_hash',
              type='button',
              @click='navigateToProject(row.parent_hash)'
            ) {{ row.parent_title || 'Проект' }}
            span.t-sm.t-muted(v-if='showOwner') · {{ row.display_name || row.username }}

        .contrib-results__meta
          span.contrib-results__amount.t-mono {{ formatMoney(row.intellectual_cost) }}
          span.contrib-results__share.t-sm.t-muted
            | {{ Number(row.share_percent || 0).toFixed(2) }}% объекта
            q-tooltip {{ showOwner ? 'Доля участника в объекте авторских прав' : 'Ваша доля в объекте авторских прав' }}

        .contrib-results__actions
          //- Голосование не отдельная шторка: кнопка открывает ту же панель
          //- подробностей, где голосование стоит первой секцией
          BaseButton(
            v-if='ownerAction(row) === "vote" && !isOpen(row)',
            variant='primary',
            size='sm',
            @click='open(row)'
          )
            template(#icon-left)
              q-icon(name='how_to_vote', size='16px')
            | Голосовать

          ResultSubmissionActionsWidget(:segment='row', compact)

          BaseButton(
            variant='ghost',
            size='sm',
            @click='toggle(row)'
          )
            template(#icon-right)
              q-icon(:name='isOpen(row) ? "expand_less" : "expand_more"', size='18px')
            | {{ isOpen(row) ? 'Свернуть' : 'Подробнее' }}

      //- Подробности одной панелью: голосование (если голос ещё ждут) и сведения о доле
      .contrib-results__details(v-if='isOpen(row)')
        template(v-if='ownerAction(row) === "vote"')
          .contrib-results__loading(v-if='!votingProjects[row.project_hash]')
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

        SegmentResultInfoWidget(:segment='row')

</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { EmptyState, BaseBadge, BaseButton } from 'src/shared/ui/base';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useExpandableState } from 'src/shared/lib/composables';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { api as ProjectApi } from 'app/extensions/capital/entities/Project/api';
import { useListNavigation } from 'app/extensions/capital/shared/composables/useListNavigation';
import {
  getSegmentBadge,
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

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { info } = useSystemStore();
const { navigateToProject, navigateToComponent } = useListNavigation();

/**
 * Раскрытые строки переживают уход на страницу компонента и возврат назад:
 * иначе список каждый раз схлопывается и пайщик разворачивает его заново.
 */
const {
  expanded,
  loadExpandedState,
  toggleExpanded: toggleExpandedRow,
} = useExpandableState('capital_results_rows_expanded');

const votingProjects = ref<Record<string, IProject>>({});
const votingExpanded = ref<Record<string, boolean>>({});
const segmentsToReload = ref<Record<string, number>>({});

const governSymbol = computed(() => info.symbols?.root_govern_symbol || 'RUB');

/** Ключ строки: одна доля — это пара «проект + участник» */
const rowKey = (segment: ISegment) => `${segment.project_hash}_${segment.username}`;

const isOwnRow = (segment: ISegment) => segment.username === props.currentUsername;

const ownerAction = (segment: ISegment) =>
  isOwnRow(segment) ? getSegmentOwnerAction(segment) : 'none';

const badge = (segment: ISegment) => getSegmentBadge(segment, isOwnRow(segment));

const formatMoney = (raw?: string | null) => {
  const value = parseFloat(String(raw || '0'));
  return formatAsset2Digits(`${value} ${governSymbol.value}`);
};

const isOpen = (segment: ISegment) => !!expanded.value[rowKey(segment)];

const open = async (segment: ISegment) => {
  if (!isOpen(segment)) toggleExpandedRow(rowKey(segment));
  await ensureVotingProject(segment);
};

const toggle = async (segment: ISegment) => {
  const willOpen = !isOpen(segment);
  toggleExpandedRow(rowKey(segment));
  if (willOpen) await ensureVotingProject(segment);
};

/** Данные голосования нужны только раскрытой строке — грузим по требованию */
const ensureVotingProject = async (segment: ISegment) => {
  if (getSegmentOwnerAction(segment) !== 'vote') return;

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
  }
};

const toggleVotingSegment = (username: string) => {
  votingExpanded.value[username] = !votingExpanded.value[username];
};

const handleVotesChanged = (data: { projectHash: string; voter: string }) => {
  segmentsToReload.value[data.voter] = Date.now();
  emit('updated');
};

onMounted(() => {
  loadExpandedState();
});
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
    height: 68px;
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

// Строка в один ряд: название с состоянием, суммы, действия
.contrib-results__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--p-4);
  padding: var(--p-3) var(--p-4);
  min-width: 0;
}

.contrib-results__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.contrib-results__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-2);
  min-width: 0;
}

.contrib-results__title {
  padding: 0;
  border: none;
  background: none;
  font-family: inherit;
  font-weight: 600;
  font-size: var(--p-fs-body);
  color: var(--p-ink);
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;

  &:hover {
    color: var(--p-primary);
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--p-focus-ring);
    border-radius: var(--p-r-sm);
  }
}

.contrib-results__path {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  min-width: 0;

  .q-icon {
    flex-shrink: 0;
    color: var(--p-ink-3);
  }
}

.contrib-results__parent {
  padding: 0;
  border: none;
  background: none;
  font-family: inherit;
  color: var(--p-ink-2);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: var(--p-primary);
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--p-focus-ring);
    border-radius: var(--p-r-sm);
  }
}

// Суммы держатся правым краем и не переносятся: числа читаются столбиком
.contrib-results__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  white-space: nowrap;
}

.contrib-results__amount {
  font-weight: 600;
  font-size: var(--p-fs-body);
  color: var(--p-ink);
  font-variant-numeric: tabular-nums;
}

.contrib-results__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--p-2);
  flex-shrink: 0;
}

// Одна панель подробностей на строку: голосование и сведения о доле
.contrib-results__details {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  padding: 0 var(--p-4) var(--p-4);
  min-width: 0;
}

.contrib-results__loading {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  padding: var(--p-3) 0;
}

@media (max-width: 720px) {
  // На узком экране строка раскладывается в столбик: название, суммы, действия
  .contrib-results__row {
    grid-template-columns: minmax(0, 1fr);
    row-gap: var(--p-2);
    padding: var(--p-3);
  }

  .contrib-results__meta {
    flex-direction: row;
    align-items: baseline;
    justify-content: flex-start;
    gap: var(--p-2);
  }

  .contrib-results__actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .contrib-results__details {
    padding: 0 var(--p-3) var(--p-3);
  }

}
</style>
