<template lang="pug">
.contributors-list.list-surface
  //- Первичная загрузка — скелетон, без спиннера поверх
  .contributors-list__skel(v-if='loading && !rows.length')
    .skel(v-for='i in 4', :key='i')

  EmptyState(
    v-else-if='!loading && !rows.length',
    title='Участников пока нет',
    body='Когда пайщики получат допуск к проекту или компоненту, они появятся в этом списке.'
  )
    template(#icon)
      q-icon(name='group')

  .contributors-list__items(v-else)
    .contributors-list__item(v-for='(row, index) in rows', :key='row._id || row.username')
      .contributors-list__row
        .contributors-list__index.t-sm.t-muted {{ index + 1 }}

        .contributors-list__main
          .contributors-list__title-row
            span.contributors-list__name {{ row.display_name || row.username }}
            q-icon.contributors-list__note-icon(
              v-if='parseValueData(row.value).text',
              name='notes',
              size='16px'
            )
              q-tooltip(anchor='bottom middle', self='top middle', max-width='320px')
                | {{ parseValueData(row.value).text }}

          .contributors-list__roles
            BaseBadge(
              v-for='role in visibleRoles(row)',
              :key='role.key',
              :variant='role.variant'
            ) {{ role.title }}

        .contributors-list__side
          .contributors-list__amount
            .t-sm.t-muted Взнос
            span.t-mono {{ formatAsset2Digits(calculateContributionAmount(row)) }}
          RefreshSegmentButton(
            v-if='segmentNeedsUpdate(row)',
            :segment='row',
            mini
          )
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { EmptyState, BaseBadge } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { formatAsset2Digits, addAssets } from 'src/shared/lib/utils';
import { useSegmentStore } from 'app/extensions/capital/entities/Segment/model';
import type {
  ISegmentsPagination,
  IGetSegmentsInput,
  ISegment,
} from 'app/extensions/capital/entities/Segment/model';
import type { IProject } from '../../entities/Project/model';
import {
  RefreshSegmentButton,
} from 'app/extensions/capital/features/Project/RefreshSegment/ui';
import { segmentNeedsUpdate } from 'app/extensions/capital/features/Project/RefreshSegment/model';

const props = defineProps<{
  project?: IProject | null;
}>();

const { info } = useSystemStore();
const segmentStore = useSegmentStore();

const segments = ref<ISegmentsPagination | null>(null);
const loading = ref(false);

const rows = computed(() => segments.value?.items || []);

const loadSegments = async () => {
  loading.value = true;

  try {
    const filter: NonNullable<IGetSegmentsInput['filter']> = {
      coopname: info.coopname,
    };

    if (props.project?.project_hash) {
      filter.project_hash = props.project.project_hash;
    }

    await segmentStore.loadSegments({
      filter,
      options: {
        page: 1,
        limit: 1000,
        sortBy: '_created_at',
        sortOrder: 'DESC',
      },
    });

    segments.value = segmentStore.getSegmentsByProject(
      props.project?.project_hash || '',
    );
  } catch (error) {
    console.error('Ошибка при загрузке сегментов:', error);
    FailAlert('Не удалось загрузить список участников');
  } finally {
    loading.value = false;
  }
};

const calculateContributionAmount = (row: ISegment): string => {
  return addAssets(row.intellectual_cost, row.investor_amount);
};

const parseValueData = (value: string | null | undefined) => {
  if (!value) return { text: '', roles: [] as string[] };

  try {
    const parsed = JSON.parse(value);
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      roles: Array.isArray(parsed.roles) ? (parsed.roles as string[]) : [],
    };
  } catch {
    return { text: '', roles: [] as string[] };
  }
};

const roleTitles: Record<string, string> = {
  author: 'Соавтор',
  creator: 'Исполнитель',
  investor: 'Инвестор',
  contributor: 'Участник',
};

const roleFields: Record<string, keyof ISegment> = {
  author: 'is_author',
  creator: 'is_creator',
  investor: 'is_investor',
  contributor: 'is_contributor',
};

/** Роль исполняется → info; только заявлена → neutral; иначе не показываем */
const visibleRoles = (
  row: ISegment,
): Array<{ key: string; title: string; variant: BaseBadgeVariant }> => {
  const claimed = parseValueData(row.value).roles;
  const out: Array<{ key: string; title: string; variant: BaseBadgeVariant }> =
    [];

  for (const [key, title] of Object.entries(roleTitles)) {
    const isExecuted = Boolean(row[roleFields[key]]);
    const isClaimed = claimed.includes(key);
    if (!isExecuted && !isClaimed) continue;
    out.push({
      key,
      title,
      variant: isExecuted ? 'info' : 'neutral',
    });
  }
  return out;
};

onMounted(async () => {
  if (props.project) {
    await loadSegments();
  }
});

watch(
  () => props.project?.project_hash,
  async (newHash, oldHash) => {
    if (newHash && newHash !== oldHash) {
      await loadSegments();
    }
  },
);

watch(
  () => props.project?.fact?.total,
  async (newTotal, oldTotal) => {
    if (newTotal !== oldTotal && props.project?.project_hash) {
      await loadSegments();
    }
  },
);
</script>

<style lang="scss" scoped>
.list-surface {
  background: var(--p-surface);
}

.contributors-list {
  min-width: 0;
}

.contributors-list__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-3) 0;
}

.contributors-list__items {
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--p-line);
}

.contributors-list__item {
  border-bottom: 1px solid var(--p-line);
}

.contributors-list__row {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3);
  padding: var(--p-3) 0;
  min-width: 0;
}

.contributors-list__index {
  flex: 0 0 1.5rem;
  text-align: right;
  padding-top: 2px;
}

.contributors-list__main {
  flex: 1 1 12rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.contributors-list__title-row {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  min-width: 0;
}

.contributors-list__name {
  font-weight: 500;
  color: var(--p-ink);
  word-break: break-word;
}

.contributors-list__note-icon {
  flex-shrink: 0;
  color: var(--p-ink-3);
  cursor: help;
}

.contributors-list__roles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-1);
}

.contributors-list__side {
  flex: 0 1 auto;
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--p-2);
  max-width: 100%;
}

.contributors-list__amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  color: var(--p-ink);
  white-space: nowrap;
}
</style>
