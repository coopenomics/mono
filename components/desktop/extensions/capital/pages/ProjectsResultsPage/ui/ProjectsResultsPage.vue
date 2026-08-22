<template lang="pug">
//- Родитель «Результаты»: список на корне, деталь — child через router-view
router-view(v-if='!isResultsRoot')
.results-page-shell.column.flex-1.min-h-0.min-w-0.no-wrap(v-else)
  PageTabs(
    :tabs='tabs',
    :active-key='activeTab',
    @select='onSelectTab'
  )

  .page-surface.results-page__body.col.flex-1.min-h-0.min-w-0
    //- На приёмке: доли, по которым процесс ещё идёт
    template(v-if='activeTab === "pending"')
      ContributorResultsListWidget(
        :rows='pendingRows',
        :coopname='info.coopname',
        :current-username='username',
        :loading='isSegmentsLoading',
        empty-title='Сейчас от вас ничего не требуется',
        empty-body='Здесь появятся результаты, по которым идёт голосование или приёмка с вашим участием.',
        @updated='reloadMySegments'
      )

    //- Мои результаты: все доли участника, включая полученные
    template(v-else-if='activeTab === "mine"')
      ContributorResultsListWidget(
        :rows='myRows',
        :coopname='info.coopname',
        :current-username='username',
        :loading='isSegmentsLoading',
        empty-title='Результатов пока нет',
        empty-body='Доли в объектах авторских прав появятся здесь после завершения работ по компонентам.',
        @updated='reloadMySegments'
      )

    //- На подпись: доли, ожидающие подписи председателя на акте
    template(v-else-if='activeTab === "sign" && isChairman')
      ContributorResultsListWidget(
        :rows='toSignRows',
        :coopname='info.coopname',
        :current-username='username',
        :loading='isToSignLoading',
        show-owner,
        empty-title='Актов на подпись нет',
        empty-body='Здесь появятся акты приёма-передачи, подписанные пайщиками и ожидающие вашей подписи.',
        @updated='reloadSegmentsToSign'
      )

    //- Все результаты: доли всех участников — теми же строками и статусами
    template(v-else-if='activeTab === "all" && canSeeAll')
      ContributorResultsListWidget(
        :rows='allRows',
        :coopname='info.coopname',
        :current-username='username',
        :loading='isAllLoading',
        show-owner,
        empty-title='Результатов пока нет',
        empty-body='Здесь появятся доли участников в объектах авторских прав по всем компонентам кооператива.',
        @updated='reloadAllSegments'
      )
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { PageTabs } from 'src/shared/ui/layout';
import type { PageTab } from 'src/shared/ui/layout/PageTabs';
import { useDataPoller } from 'src/shared/lib/composables';
import { POLL_INTERVALS } from 'src/shared/lib/consts';
import { ContributorResultsListWidget } from 'app/extensions/capital/widgets';
import { api as SegmentApi } from 'app/extensions/capital/entities/Segment/api';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';
import {
  getSegmentOwnerAction,
  isSegmentOnAcceptance,
} from 'app/extensions/capital/shared/lib/segmentStatus';

type ResultsTab = 'pending' | 'mine' | 'sign' | 'all';

/** Сколько долей читается за раз: у участника их десятки, не тысячи */
const SEGMENTS_LIMIT = 1000;


const router = useRouter();
const route = useRoute();
const { info } = useSystemStore();
const session = useSessionStore();

const isResultsRoot = computed(() => route.name === 'results');

const username = computed(() => session.username || '');
const isChairman = computed(() => session.isChairman);
const canSeeAll = computed(() => session.isChairman || session.isMember);

/**
 * Вкладка живёт в адресе: пайщик уходит со стола на компонент и возвращается
 * кнопкой «назад» — без адреса он попадал бы на первую вкладку вместо своей.
 */
const TABS: ResultsTab[] = ['pending', 'mine', 'sign', 'all'];

const tabFromRoute = (): ResultsTab => {
  const tab = route.query.tab as string | undefined;
  return TABS.includes(tab as ResultsTab) ? (tab as ResultsTab) : 'pending';
};

const activeTab = ref<ResultsTab>(tabFromRoute());

const mySegments = ref<ISegment[]>([]);
const segmentsToSign = ref<ISegment[]>([]);
const allSegments = ref<ISegment[]>([]);
const isSegmentsLoading = ref(true);
const isToSignLoading = ref(true);
const isAllLoading = ref(true);

/**
 * Порядок строк задаётся явно и не зависит от порядка ответа сервера:
 * список перечитывается по таймеру, и «плавающая» сортировка уводила бы
 * строку из-под курсора. Сначала то, где ход за пайщиком, затем работа
 * в процессе, затем завершённое; внутри — по названию.
 */
const sortRows = (rows: ISegment[]): ISegment[] => {
  const weight = (segment: ISegment) => {
    if (getSegmentOwnerAction(segment) !== 'none') return 0;
    if (isSegmentOnAcceptance(segment)) return 1;
    return 2;
  };

  return [...rows].sort((left, right) => {
    const byWeight = weight(left) - weight(right);
    if (byWeight !== 0) return byWeight;

    const byTitle = (left.project_title || '').localeCompare(
      right.project_title || '',
      'ru',
    );
    if (byTitle !== 0) return byTitle;

    return left.project_hash.localeCompare(right.project_hash);
  });
};

/**
 * «На приёмке» — доли, по которым приёмка уже началась и не закончена:
 * голосование, внесение результата, подписи и получение доли. В какой именно
 * стадии процесс, пайщику знать не нужно — важно, что дело ещё не закрыто.
 */
const pendingRows = computed(() =>
  sortRows(mySegments.value.filter((segment) => isSegmentOnAcceptance(segment))),
);

const myRows = computed(() => sortRows(mySegments.value));

const toSignRows = computed(() => sortRows(segmentsToSign.value));

const allRows = computed(() => sortRows(allSegments.value));

const pendingActionCount = computed(
  () =>
    mySegments.value.filter(
      (segment) => getSegmentOwnerAction(segment) !== 'none',
    ).length,
);

const tabs = computed<PageTab[]>(() => {
  const list: PageTab[] = [
    {
      key: 'pending',
      label: 'На приёмке',
      count: pendingActionCount.value || undefined,
    },
    { key: 'mine', label: 'Мои результаты' },
  ];

  if (isChairman.value) {
    list.push({
      key: 'sign',
      label: 'На подпись',
      count: segmentsToSign.value.length || undefined,
    });
  }

  if (canSeeAll.value) {
    list.push({ key: 'all', label: 'Все результаты' });
  }

  return list;
});

function onSelectTab(tab: PageTab) {
  selectTab(tab.key as ResultsTab);
}

function selectTab(tab: ResultsTab) {
  if (activeTab.value === tab && route.query.tab === tab) return;
  activeTab.value = tab;
  // Замена, а не переход: перебор вкладок не должен копиться в истории
  router.replace({ query: { ...route.query, tab } });
}

// Возврат назад и переход по ссылке приводят вкладку в соответствие адресу
watch(
  () => route.query.tab,
  () => {
    activeTab.value = tabFromRoute();
  },
);

// Адрес с чужой вкладкой (у пайщика нет прав совета) не оставляет пустой экран
watch(tabs, (list) => {
  if (!list.some((tab) => tab.key === activeTab.value)) {
    selectTab('pending');
  }
});

const reloadMySegments = async () => {
  if (!username.value) return;
  try {
    const loaded = await SegmentApi.loadSegments({
      filter: {
        coopname: info.coopname,
        username: username.value,
        // Результат приходуется по компоненту: у проекта верхнего уровня своего
        // результата нет — он складывается из результатов компонентов
        is_component: true,
      },
      options: { page: 1, limit: SEGMENTS_LIMIT, sortOrder: 'DESC' },
    });
    mySegments.value = loaded.items as ISegment[];
  } catch (error) {
    console.error('Ошибка при загрузке долей участника:', error);
  } finally {
    isSegmentsLoading.value = false;
  }
};

const reloadSegmentsToSign = async () => {
  if (!isChairman.value) {
    isToSignLoading.value = false;
    return;
  }
  try {
    const loaded = await SegmentApi.loadSegments({
      filter: {
        coopname: info.coopname,
        status: Zeus.SegmentStatus.ACT1,
        is_component: true,
      },
      options: { page: 1, limit: SEGMENTS_LIMIT, sortOrder: 'DESC' },
    });
    segmentsToSign.value = loaded.items as ISegment[];
  } catch (error) {
    console.error('Ошибка при загрузке актов на подпись:', error);
  } finally {
    isToSignLoading.value = false;
  }
};

/** Сводный список долей: доступен совету и председателю */
const reloadAllSegments = async () => {
  if (!canSeeAll.value) {
    isAllLoading.value = false;
    return;
  }
  try {
    const loaded = await SegmentApi.loadSegments({
      filter: {
        coopname: info.coopname,
        is_component: true,
      },
      options: { page: 1, limit: SEGMENTS_LIMIT, sortOrder: 'DESC' },
    });
    allSegments.value = loaded.items as ISegment[];
  } catch (error) {
    console.error('Ошибка при загрузке сводного списка долей:', error);
  } finally {
    isAllLoading.value = false;
  }
};

const reloadAll = async () => {
  await Promise.all([
    reloadMySegments(),
    reloadSegmentsToSign(),
    reloadAllSegments(),
  ]);
};

const { start: startPoll, stop: stopPoll } = useDataPoller(reloadAll, {
  interval: POLL_INTERVALS.MEDIUM,
  immediate: false,
});

onMounted(async () => {
  await reloadAll();
  // Пайщику без своих долей показывать пустую вкладку незачем — совет
  // приходит сюда за сводным списком. Явно выбранную вкладку не трогаем.
  if (!route.query.tab && !mySegments.value.length && canSeeAll.value) {
    selectTab('all');
  }
  startPoll();
});

onBeforeUnmount(() => {
  stopPoll();
});
</script>

<style lang="scss" scoped>
// Оболочка: табы на --p-canvas (глобальный .tabbar), контент на --p-surface
.results-page-shell {
  height: calc(100vh - var(--p-topbar-h));
  max-height: calc(100vh - var(--p-topbar-h));
  overflow: hidden;
}

.page-surface {
  background: var(--p-surface);
  overflow: auto;
}

.results-page__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
}

@media (max-width: 768px) {
  .results-page__body {
    padding: var(--p-4);
  }
}
</style>
