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

  q-infinite-scroll.contributors-list__items(
    v-else,
    :disable='!hasMore',
    :offset='200',
    @load='onLoad'
  )
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

    template(#loading)
      .contributors-list__more
        q-spinner(size='20px', color='primary')
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { EmptyState, BaseBadge } from 'src/shared/ui/base';
import type { BaseBadgeVariant } from 'src/shared/ui/base';
import { formatAsset2Digits, addAssets } from 'src/shared/lib/utils';
import {
  useSegmentStore,
  CONTRIBUTORS_PAGE_SIZE,
} from 'app/extensions/capital/entities/Segment/model';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';
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

const loading = ref(false);

const projectHash = computed(() => props.project?.project_hash || '');

// Читаем список прямо из хранилища, а не копией: любое обновление долей
// (добавление соавтора, пересчёт, подписание акта) сразу видно в списке.
// С локальной копией новый список из хранилища до нас не доходил.
const segments = computed(() =>
  segmentStore.getSegmentsByProject(projectHash.value),
);

const rows = computed(() => segments.value?.items || []);

// Счёт загруженных страниц: список догружается по мере прокрутки.
const nextPage = ref(1);
const totalPages = ref(0);

const hasMore = computed(() => nextPage.value <= totalPages.value);

/**
 * Загружает одну страницу участников. Первая страница заменяет список,
 * последующие дописываются в конец.
 */
const loadPage = async (page: number, append: boolean): Promise<void> => {
  if (!projectHash.value) return;

  if (!append) {
    loading.value = true;
  }

  try {
    const result = await segmentStore.loadSegments(
      {
        filter: {
          coopname: info.coopname,
          project_hash: projectHash.value,
        },
        options: {
          page,
          limit: CONTRIBUTORS_PAGE_SIZE,
          sortBy: '_created_at',
          sortOrder: 'DESC',
        },
      },
      append,
    );

    totalPages.value = result.totalPages || 1;
    nextPage.value = page + 1;
  } catch (error) {
    console.error('Ошибка при загрузке сегментов:', error);
    FailAlert('Не удалось загрузить список участников');
    throw error;
  } finally {
    if (!append) {
      loading.value = false;
    }
  }
};

/** Перечитывает список с первой страницы, сбрасывая счёт страниц. */
const reload = async (): Promise<void> => {
  nextPage.value = 1;
  totalPages.value = 0;
  await loadPage(1, false).catch(() => undefined);
};

/**
 * Догрузка очередной страницы при прокрутке. Ответ обязателен в любом
 * исходе — иначе прокрутка навсегда останется в состоянии загрузки.
 */
const onLoad = async (_index: number, done: (stop?: boolean) => void): Promise<void> => {
  if (!hasMore.value) {
    done(true);
    return;
  }

  try {
    await loadPage(nextPage.value, true);
    done(!hasMore.value);
  } catch {
    done(true);
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
  if (projectHash.value) {
    await reload();
  }
});

watch(projectHash, async (newHash, oldHash) => {
  if (newHash && newHash !== oldHash) {
    await reload();
  }
});

watch(
  () => props.project?.fact?.total,
  async (newTotal, oldTotal) => {
    if (newTotal !== oldTotal && projectHash.value) {
      await reload();
    }
  },
);

// Просьба перечитать список от действий, меняющих состав участников
// (добавление соавтора). Счёт страниц ведём здесь, поэтому и перечитываем
// здесь же — подмена списка снаружи рассинхронизировала бы прокрутку.
watch(
  () => segmentStore.reloadRequests[projectHash.value],
  async (next, prev) => {
    if (next && next !== prev && projectHash.value) {
      await reload();
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

.contributors-list__more {
  display: flex;
  justify-content: center;
  padding: var(--p-3) 0;
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
