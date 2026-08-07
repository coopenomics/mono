<template lang="pug">
span
  BaseButton(
    variant='primary',
    :size='isMobile ? "sm" : "md"',
    :icon-only='isMobile',
    aria-label='Аллоцировать средства',
    @click='open = true'
  )
    template(#icon-left)
      q-icon(name='savings', size='18px')
    template(v-if='!isMobile', #default)
      | Аллоцировать средства
    q-tooltip(v-if='isMobile') Аллоцировать средства

  AllocateFundsDialog(
    v-model='open',
    :options='allocationTargets',
    :available='freePool',
    @allocated='onAllocated'
  )
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { useWindowSize } from 'src/shared/hooks';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import type { BaseSelectOption } from 'src/shared/ui/base/BaseSelect';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { useConfigStore } from 'app/extensions/capital/entities/Config/model';
import AllocateFundsDialog from './AllocateFundsDialog.vue';

const system = useSystemStore();
const projectStore = useProjectStore();
const configStore = useConfigStore();
const { isMobile } = useWindowSize();

const open = ref(false);

function assetToNumber(asset?: string | null): number {
  if (!asset) return 0;
  const numeric = Number.parseFloat(String(asset).split(' ')[0] ?? '');
  return Number.isNaN(numeric) ? 0 : numeric;
}

const freePool = computed(() =>
  assetToNumber(configStore.state?.global_available_invest_pool),
);

// Финансируем проекты через их компоненты, поэтому целями аллокации выступают
// только компоненты — сами проекты в список не попадают.
const allocationTargets = computed<BaseSelectOption[]>(() =>
  (projectStore.projects.items ?? []).flatMap((project) =>
    (project.components ?? []).map((component: any) => ({
      value: component.project_hash,
      label: `${project.title ?? ''} · ${component.title ?? ''}`,
    })),
  ),
);

/** Parser → PG обычно отстаёт от блока на 1–3с; ранний refetch вернёт прежние суммы. */
const POST_CHAIN_REFETCH_MS = 3500;

let refetchTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Перечитываем сторы молча: страница читает их реактивно и обновит суммы сама,
 * не подменяя готовую таблицу заглушкой загрузки.
 */
function onAllocated(): void {
  refetchTimer = setTimeout(() => {
    const coopname = system.info.coopname;
    void projectStore.loadProjects({
      filter: { coopname, is_component: false },
      options: { page: 1, limit: 100 },
    });
    void configStore.loadState({ coopname });
  }, POST_CHAIN_REFETCH_MS);
}

onBeforeUnmount(() => {
  if (refetchTimer) clearTimeout(refetchTimer);
});
</script>
