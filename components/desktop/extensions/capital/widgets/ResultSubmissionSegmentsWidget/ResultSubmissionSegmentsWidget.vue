<template lang="pug">
.result-segments
  .result-segments__skel(v-if='loading && !rows.length')
    .skel(v-for='i in 3', :key='i')

  EmptyState(
    v-else-if='!loading && !rows.length',
    title='Нет участников',
    body='Сегменты появятся после формирования результатов по проекту.'
  )
    template(#icon)
      q-icon(name='group')

  .result-segments__items(v-else)
    .result-segments__item(v-for='segment in rows', :key='segment.username')
      .result-segments__row(
        role='button',
        tabindex='0',
        @click='handleSegmentClick(segment.username)',
        @keydown.enter.prevent='handleSegmentClick(segment.username)',
        @keydown.space.prevent='handleSegmentClick(segment.username)'
      )
        ExpandToggleButton(
          :expanded='!!expanded[segment.username]',
          @click='handleToggleExpand(segment.username)'
        )

        .result-segments__main
          .result-segments__name {{ segment.display_name }}
          .result-segments__roles
            BaseBadge(v-if='segment.is_author', variant='info') Соавтор
            BaseBadge(v-if='segment.is_creator', variant='neutral') Исполнитель
            BaseBadge(v-if='segment.is_coordinator', variant='info') Координатор
            BaseBadge(v-if='segment.is_contributor', variant='pos') Участник

          .result-segments__metrics(
            v-if='segment.status !== Zeus.SegmentStatus.GENERATION'
          )
            .result-segments__metric
              span.t-sm.t-muted Генерация
              span.t-mono {{ formatMetric(calculateGeneration(segment).amount) }}
              span.t-sm.t-muted {{ calculateGeneration(segment).share }}%
            .result-segments__metric
              span.t-sm.t-muted Благорост
              span.t-mono {{ formatMetric(calculateBlagorost(segment).amount) }}
              span.t-sm.t-muted {{ calculateBlagorost(segment).share }}%
            .result-segments__metric
              span.t-sm.t-muted Всего
              span.t-mono {{ formatMetric(segment.intellectual_cost) }}
              span.t-sm.t-muted {{ Number(segment.share_percent || 0).toFixed(2) }}%

        .result-segments__side(@click.stop)
          BaseBadge(:variant='statusVariant(segment)') {{ shortStatus(segment) }}
          slot(name='actions', :segment='segment')

      .result-segments__details(v-if='expanded[segment.username]')
        SegmentResultInfoWidget(:segment='segment')
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import {
  useSegmentStore,
  type ISegment,
} from 'app/extensions/capital/entities/Segment/model';
import { SegmentResultInfoWidget } from '../SegmentResultInfoWidget';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useSystemStore } from 'src/entities/System/model';
import { Zeus } from '@coopenomics/sdk';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { EmptyState, BaseBadge } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { getSegmentStatusLabel } from 'app/extensions/capital/shared/lib/segmentStatus';

interface Props {
  projectHash: string;
  coopname: string;
  expanded: Record<string, boolean>;
  project?: IProject;
}

interface Emits {
  (e: 'toggle-expand', value: string): void;
  (e: 'segment-click', value: string): void;
  (e: 'data-loaded', value: string[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const segmentStore = useSegmentStore();
const { info } = useSystemStore();

const loading = ref(false);

const rows = computed(
  () => segmentStore.getSegmentsByProject(props.projectHash)?.items || [],
);

const governSymbol = computed(
  () => info.symbols?.root_govern_symbol || 'RUB',
);

const calculateGeneration = (segment: ISegment) => {
  const amount =
    parseFloat(segment.creator_base || '0') +
    parseFloat(segment.author_base || '0') +
    parseFloat(segment.direct_creator_bonus || '0') +
    parseFloat(segment.equal_author_bonus || '0') +
    parseFloat(segment.coordinator_base || '0') +
    parseFloat(segment.property_base || '0') +
    parseFloat(segment.voting_bonus || '0');

  const total = parseFloat(props.project?.fact?.total?.split(' ')[0] || '1');
  const share = total > 0 ? (amount / total) * 100 : 0;

  return {
    amount,
    share: share.toFixed(2),
  };
};

const calculateBlagorost = (segment: ISegment) => {
  const amount = parseFloat(segment.contributor_bonus || '0');
  const total = parseFloat(props.project?.fact?.total?.split(' ')[0] || '1');
  const share = total > 0 ? (amount / total) * 100 : 0;

  return {
    amount,
    share: share.toFixed(2),
  };
};

const formatMetric = (amount: string | number) => {
  const value = parseFloat(String(amount || '0'));
  return formatAsset2Digits(`${value} ${governSymbol.value}`);
};

const shortStatus = (segment: ISegment) => {
  if (segment.is_completed) return 'Получен';
  switch (segment.status) {
    case Zeus.SegmentStatus.GENERATION:
      return 'Расчёт';
    case Zeus.SegmentStatus.READY:
      return 'Готов';
    case Zeus.SegmentStatus.STATEMENT:
      return 'На рассмотрении';
    case Zeus.SegmentStatus.APPROVED:
      return 'Одобрен';
    case Zeus.SegmentStatus.AUTHORIZED:
      return 'Подпись пайщика';
    case Zeus.SegmentStatus.ACT1:
      return 'Подпись председателя';
    case Zeus.SegmentStatus.CONTRIBUTED:
      return 'Принят';
    case Zeus.SegmentStatus.FINALIZED:
      return 'Завершён';
    default:
      return getSegmentStatusLabel(segment.status, segment.is_completed, segment);
  }
};

const statusVariant = (segment: ISegment): BaseBadgeVariant => {
  if (segment.is_completed) return 'pos';
  switch (segment.status) {
    case Zeus.SegmentStatus.GENERATION:
      return 'warn';
    case Zeus.SegmentStatus.READY:
      return 'info';
    case Zeus.SegmentStatus.STATEMENT:
    case Zeus.SegmentStatus.APPROVED:
    case Zeus.SegmentStatus.AUTHORIZED:
    case Zeus.SegmentStatus.ACT1:
      return 'info';
    case Zeus.SegmentStatus.CONTRIBUTED:
    case Zeus.SegmentStatus.FINALIZED:
      return 'pos';
    default:
      return 'neutral';
  }
};

const loadProjectSegments = async () => {
  loading.value = true;
  try {
    await segmentStore.loadSegments({
      filter: {
        coopname: props.coopname,
        project_hash: props.projectHash,
      },
      options: {
        page: 1,
        limit: 1000,
        sortOrder: 'ASC',
      },
    });

    const usernames =
      segmentStore
        .getSegmentsByProject(props.projectHash)
        ?.items.map((s: any) => s.username) || [];
    emit('data-loaded', usernames);
  } catch (error) {
    console.error('Ошибка при загрузке сегментов проекта:', error);
    FailAlert('Не удалось загрузить сегменты проекта');
  } finally {
    loading.value = false;
  }
};

const handleSegmentClick = (username: string) => {
  emit('segment-click', username);
};

const handleToggleExpand = (username: string) => {
  emit('toggle-expand', username);
};

onMounted(async () => {
  await loadProjectSegments();
});

watch(
  () => props.projectHash,
  async () => {
    await loadProjectSegments();
  },
);
</script>

<style lang="scss" scoped>
.result-segments {
  min-width: 0;
}

.result-segments__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-4) 0;

  .skel {
    height: 72px;
  }
}

.result-segments__items {
  display: flex;
  flex-direction: column;
}

.result-segments__item {
  border-bottom: 1px solid var(--p-line);

  &:last-child {
    border-bottom: none;
  }
}

.result-segments__row {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3);
  padding: var(--p-4) 0;
  min-width: 0;
  cursor: pointer;
}

.result-segments__main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.result-segments__name {
  font-weight: 500;
  font-size: var(--p-fs-body);
  color: var(--p-ink);
}

.result-segments__roles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-1);
}

.result-segments__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-6) var(--p-7);
  padding-top: var(--p-2);
}

.result-segments__metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 120px;

  .t-mono {
    font-weight: 600;
    color: var(--p-ink);
  }
}

.result-segments__side {
  flex: 0 1 200px;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--p-2);
}

.result-segments__details {
  padding: 0 0 var(--p-4) var(--p-8);
}

@media (max-width: 640px) {
  .result-segments__row {
    flex-wrap: wrap;
  }

  .result-segments__side {
    flex: 1 1 100%;
    align-items: stretch;
    min-width: 0;
  }

  .result-segments__details {
    padding-left: var(--p-4);
  }
}
</style>
