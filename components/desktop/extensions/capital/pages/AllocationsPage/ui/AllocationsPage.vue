<template lang="pug">
q-page.allocations-page
  .pools.row.q-col-gutter-md
    .col-12.col-md-6
      WalletCard(
        neutral,
        title='Свободные средства программы',
        subtitle='Остаток, который можно аллоцировать в компоненты',
        balance-label='Доступно',
        :balance='freePool.amount',
        :symbol='freePool.symbol',
        icon='savings',
        :loading='!configStore.state'
      )
    .col-12.col-md-6
      WalletCard(
        program='blagorost',
        title='Аллоцировано в компоненты',
        subtitle='Средства программы, ставшие бюджетом компонентов',
        balance-label='Всего',
        :balance='allocatedTotal.amount',
        :symbol='allocatedTotal.symbol',
        icon='account_tree',
        :loading='loading && !rows.length'
      )

  TableSkeleton(
    v-if='loading && !rows.length',
    :columns='skeletonColumns',
    :rows='5',
    min-width='720px'
  )
  .table-wrap(v-else-if='rows.length')
    .table-scroll
      table.table
        thead
          tr
            th Компонент
            th Проект
            th Статус
            th.col-num Аллоцировано
            th.col-num Использовано
            th.col-action(v-if='canDeallocate')
        tbody
          tr.data-row(v-for='row in rows', :key='row.project_hash', @click='openComponent(row)')
            td.cell-name {{ row.title }}
            td {{ row.project_title }}
            td
              BaseBadge(:variant='row.status_variant') {{ row.status_label }}
            td.col-num {{ row.allocated }}
            td.col-num {{ row.used }}
            td.col-action(v-if='canDeallocate')
              DeallocateFundsButton(
                v-if='row.can_deallocate',
                :project-hash='row.project_hash',
                :component-title='row.title'
              )
  EmptyState(
    v-else,
    title='Средства пока не аллоцированы',
    body='Здесь появятся компоненты, получившие бюджет программы.'
  )
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, markRaw } from 'vue';
import { useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useHeaderActions } from 'src/shared/hooks';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { BaseBadge } from 'src/shared/ui/base/BaseBadge';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { TableSkeleton } from 'src/shared/ui/base/TableSkeleton';
import type { TableSkeletonColumn } from 'src/shared/ui/base/TableSkeleton';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { addAssets } from 'src/shared/lib/utils/addAssets';
import { getProjectStatusLabel } from 'app/extensions/capital/shared/lib/projectStatus';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { useConfigStore } from 'app/extensions/capital/entities/Config/model';
import { AllocateFundsButton } from 'app/extensions/capital/features/Invest/AllocateFunds/ui';
import { DeallocateFundsButton } from 'app/extensions/capital/features/Invest/DeallocateFunds/ui';

interface AllocationRow {
  project_hash: string;
  title: string;
  project_title: string;
  status_label: string;
  status_variant: BaseBadgeVariant;
  allocated: string;
  used: string;
  /** Возврат разрешён контрактом только до начала голосования */
  can_deallocate: boolean;
}

/** Статусы компонента, в которых контракт разрешает вернуть средства в программу. */
const DEALLOCATABLE_STATUSES = ['pending', 'active'];

const system = useSystemStore();
const session = useSessionStore();
const projectStore = useProjectStore();
const configStore = useConfigStore();
const router = useRouter();
const { registerAction, unregisterAction } = useHeaderActions();

const coopname = computed(() => system.info.coopname);

const loading = ref(false);

function splitAsset(asset?: string | null): { amount: string; symbol: string } {
  const fallbackSymbol = system.info?.symbols?.root_govern_symbol ?? 'RUB';
  if (!asset) return { amount: '0,00', symbol: fallbackSymbol };
  const parts = formatAsset2Digits(asset).split(' ');
  return { amount: parts[0] || '0,00', symbol: parts[1] || fallbackSymbol };
}

function assetToNumber(asset?: string | null): number {
  if (!asset) return 0;
  const numeric = Number.parseFloat(String(asset).split(' ')[0] ?? '');
  return Number.isNaN(numeric) ? 0 : numeric;
}

const freePool = computed(() =>
  splitAsset(configStore.state?.global_available_invest_pool),
);
// Запрашиваем только проекты верхнего уровня: компоненты приходят вложенными
// в каждый проект. Без этого фильтра компоненты возвращались бы ещё и
// самостоятельными строками, а их бюджет попадал бы в итог дважды —
// один раз сам, второй в составе агрегата проекта.
const projects = computed(() => projectStore.projects.items ?? []);

/** Все компоненты кооператива с указанием проекта, к которому относятся. */
const components = computed(() =>
  projects.value.flatMap((project) =>
    (project.components ?? []).map((component: any) => ({
      component,
      projectTitle: project.title ?? '',
    })),
  ),
);

// Итог берём по проектам: их fact — агрегат вместе с компонентами, поэтому
// сумма покрывает и средства, аллоцированные в компоненты.
const allocatedTotal = computed(() => {
  const total = projects.value.reduce(
    (acc, project) => addAssets(acc, project.fact?.program_invest_pool ?? '0.0000'),
    '0.0000',
  );
  return splitAsset(total);
});

const STATUS_VARIANTS: Record<string, BaseBadgeVariant> = {
  PENDING: 'neutral',
  ACTIVE: 'accent',
  VOTING: 'info',
  RESULT: 'pos',
  FINALIZED: 'pos',
};

// В таблице — только компоненты, получившие бюджет: аллокация идёт в них,
// проект финансируется через свои компоненты.
const rows = computed<AllocationRow[]>(() =>
  components.value
    .filter(({ component }) => assetToNumber(component.fact?.program_invest_pool) > 0)
    .map(({ component, projectTitle }) => {
      const status = String(component.status ?? '');
      return {
        project_hash: component.project_hash,
        title: component.title ?? '',
        project_title: projectTitle,
        status_label: getProjectStatusLabel(status),
        status_variant: STATUS_VARIANTS[status.toUpperCase()] ?? 'neutral',
        allocated: formatAsset2Digits(component.fact?.program_invest_pool ?? '0.0000'),
        used: formatAsset2Digits(component.fact?.total_used_investments ?? '0.0000'),
        can_deallocate: DEALLOCATABLE_STATUSES.includes(status.toLowerCase()),
      };
    }),
);

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Компонент' },
  { label: 'Проект' },
  { label: 'Статус', cell: 'badge' },
  { label: 'Аллоцировано', class: 'col-num' },
  { label: 'Использовано', class: 'col-num' },
];

// Возвращать средства может только председатель — совет видит таблицу без колонки действий.
const canDeallocate = computed(() => session.isChairman);

async function loadData(): Promise<void> {
  await Promise.all([
    projectStore.loadProjects({
      filter: { coopname: coopname.value, is_component: false },
      options: { page: 1, limit: 100, sortOrder: 'ASC' },
    }),
    configStore.loadState({ coopname: coopname.value }),
  ]);
}

async function refresh(): Promise<void> {
  try {
    loading.value = true;
    await loadData();
  } finally {
    loading.value = false;
  }
}

function openComponent(row: AllocationRow): void {
  router.push({
    name: 'component-description',
    params: { project_hash: row.project_hash },
  });
}

const HEADER_ACTION_ID = 'capital-allocate-funds';

onMounted(() => {
  // Аллоцировать средства может только председатель; совет видит страницу без кнопки.
  if (session.isChairman) {
    registerAction({
      id: HEADER_ACTION_ID,
      component: markRaw(AllocateFundsButton),
      order: 1,
    });
  }
  void refresh();
});

onBeforeUnmount(() => {
  unregisterAction(HEADER_ACTION_ID);
});
</script>

<style lang="scss" scoped>
.allocations-page {
  padding: var(--p-6, 24px);
}

@media (max-width: 768px) {
  .allocations-page {
    padding: var(--p-4, 16px);
  }
}

.pools {
  margin-bottom: var(--p-5);
}

.data-row {
  cursor: pointer;
}

.col-action {
  width: 1%;
  white-space: nowrap;
  text-align: right;
}
</style>
