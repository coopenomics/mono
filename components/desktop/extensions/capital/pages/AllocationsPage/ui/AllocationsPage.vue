<template lang="pug">
q-page.allocations-page
  //- Действия страницы — в топбар через canon Teleport в слот-host шапки.
  //- Аллоцировать средства может только председатель; совет видит страницу без кнопки.
  Teleport(v-if='isChairman', to='#header-actions-host', defer)
    BaseButton(
      variant='primary',
      :size='isMobile ? "sm" : "md"',
      :icon-only='isMobile',
      aria-label='Аллоцировать средства',
      @click='openAllocate'
    )
      template(#icon-left)
        q-icon(name='savings', size='18px')
      template(v-if='!isMobile', #default)
        | Аллоцировать средства
      q-tooltip(v-if='isMobile') Аллоцировать средства

  .pools.row.q-col-gutter-md
    .col-12.col-md-6
      WalletCard(
        neutral,
        title='Свободные средства программы',
        subtitle='Остаток, который можно направить в проекты',
        balance-label='Доступно',
        :balance='freePool.amount',
        :symbol='freePool.symbol',
        icon='savings',
        :loading='!configStore.state'
      )
    .col-12.col-md-6
      WalletCard(
        program='blagorost',
        title='Аллоцировано в проекты',
        subtitle='Средства программы, ставшие бюджетом проектов',
        balance-label='Всего',
        :balance='allocatedTotal.amount',
        :symbol='allocatedTotal.symbol',
        icon='account_tree',
        :loading='loading'
      )

  EmptyState(
    v-if='!loading && !rows.length',
    title='Средства пока никуда не направлены',
    body='Здесь появятся проекты и компоненты, получившие бюджет программы.'
  )
  BaseTable(
    v-else,
    :columns='columns',
    :rows='rows',
    row-key='project_hash',
    hover
  )
    template(#cell-title='{ row }')
      .allocations-page__title(:class='{ "allocations-page__title--child": row.is_component }')
        span.allocations-page__link(@click='openProject(row)') {{ row.title }}
    template(#cell-status='{ row }')
      BaseChip(:variant='row.status_variant', size='sm') {{ row.status_label }}

  AllocateFundsDialog(
    v-model='allocateOpen',
    :options='allocationTargets',
    :available='freePoolNumber',
    @allocated='onAllocated'
  )
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useWindowSize } from 'src/shared/hooks';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { BaseTable } from 'src/shared/ui/base/BaseTable';
import type { BaseTableColumn } from 'src/shared/ui/base/BaseTable';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseChip } from 'src/shared/ui/base/BaseChip';
import type { BaseChipVariant } from 'src/shared/ui/base/BaseChip';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import type { BaseSelectOption } from 'src/shared/ui/base/BaseSelect';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { useConfigStore } from 'app/extensions/capital/entities/Config/model';
import { AllocateFundsDialog } from 'app/extensions/capital/features/Invest/AllocateFunds/ui';

interface AllocationRow extends Record<string, unknown> {
  project_hash: string;
  title: string;
  is_component: boolean;
  status_label: string;
  status_variant: BaseChipVariant;
  allocated: string;
  used: string;
}

const system = useSystemStore();
const session = useSessionStore();
const projectStore = useProjectStore();
const configStore = useConfigStore();
const router = useRouter();
const { isMobile } = useWindowSize();

const coopname = computed(() => system.info.coopname);
const isChairman = computed(() => session.isChairman);

const allocateOpen = ref(false);
const loading = ref(false);

function openAllocate(): void {
  allocateOpen.value = true;
}

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
const freePoolNumber = computed(() =>
  assetToNumber(configStore.state?.global_available_invest_pool),
);

const projects = computed(() => projectStore.projects.items ?? []);

// У проекта верхнего уровня fact — агрегат вместе с компонентами, поэтому
// итог считаем только по проектам: иначе компоненты попадут в сумму дважды.
const allocatedTotal = computed(() => {
  const symbol = system.info?.symbols?.root_govern_symbol ?? 'RUB';
  const sum = projects.value.reduce(
    (acc, project) => acc + assetToNumber(project.fact?.program_invest_pool),
    0,
  );
  return { amount: sum.toFixed(2).replace('.', ','), symbol };
});

const STATUS_LABELS: Record<string, string> = {
  pending: 'Создан',
  active: 'В работе',
  voting: 'Голосование',
  result: 'Завершён',
  finalized: 'Финализирован',
};

const STATUS_VARIANTS: Record<string, BaseChipVariant> = {
  pending: 'neutral',
  active: 'accent',
  voting: 'info',
  result: 'pos',
  finalized: 'pos',
};

function toRow(entity: any, isComponentRow: boolean): AllocationRow {
  const status = String(entity.status ?? '');
  return {
    project_hash: entity.project_hash,
    title: entity.title ?? '',
    is_component: isComponentRow,
    status_label: STATUS_LABELS[status] ?? status,
    status_variant: STATUS_VARIANTS[status] ?? 'neutral',
    allocated: formatAsset2Digits(entity.fact?.program_invest_pool ?? '0.0000'),
    used: formatAsset2Digits(entity.fact?.total_used_investments ?? '0.0000'),
  };
}

// В таблице — только то, куда деньги действительно ушли. Проект показываем,
// если бюджет есть у него самого или у любого его компонента.
const rows = computed<AllocationRow[]>(() => {
  const result: AllocationRow[] = [];

  for (const project of projects.value) {
    const components = (project.components ?? []).filter(
      (component: any) => assetToNumber(component.fact?.program_invest_pool) > 0,
    );
    const projectAllocated = assetToNumber(project.fact?.program_invest_pool);

    if (projectAllocated <= 0 && !components.length) continue;

    result.push(toRow(project, false));
    for (const component of components) {
      result.push(toRow(component, true));
    }
  }

  return result;
});

// Аллоцировать средства можно в любой проект и компонент, в том числе в те,
// у которых бюджета ещё нет — поэтому список целей шире таблицы.
const allocationTargets = computed<BaseSelectOption[]>(() => {
  const targets: BaseSelectOption[] = [];

  for (const project of projects.value) {
    targets.push({ value: project.project_hash, label: project.title ?? '' });
    for (const component of project.components ?? []) {
      targets.push({
        value: component.project_hash,
        label: `${project.title} · ${component.title}`,
      });
    }
  }

  return targets;
});

const columns: BaseTableColumn<AllocationRow>[] = [
  { key: 'title', label: 'Проект' },
  { key: 'status', label: 'Статус' },
  { key: 'allocated', label: 'Аллоцировано', numeric: true },
  { key: 'used', label: 'Использовано', numeric: true },
];

/** Parser → PG обычно отстаёт от блока на 1–3с; ранний refetch вернёт прежние суммы. */
const POST_CHAIN_REFETCH_MS = 3500;

async function refresh(): Promise<void> {
  try {
    loading.value = true;
    await Promise.all([
      projectStore.loadProjects({
        filter: { coopname: coopname.value },
        options: { page: 1, limit: 100 },
      }),
      configStore.loadState({ coopname: coopname.value }),
    ]);
  } finally {
    loading.value = false;
  }
}

function onAllocated(): void {
  setTimeout(() => {
    void refresh();
  }, POST_CHAIN_REFETCH_MS);
}

function openProject(row: AllocationRow): void {
  router.push({
    name: row.is_component ? 'component-description' : 'project-description',
    params: { project_hash: row.project_hash },
    query: { _backRoute: 'capital-allocations' },
  });
}

onMounted(() => {
  void refresh();
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

.allocations-page__title--child {
  padding-left: var(--p-5);
}

.allocations-page__link {
  cursor: pointer;

  &:hover {
    color: var(--p-primary);
  }
}
</style>
