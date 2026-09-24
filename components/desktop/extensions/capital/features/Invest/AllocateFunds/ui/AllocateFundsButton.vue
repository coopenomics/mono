<template lang="pug">
span
  BaseButton(
    variant='primary',
    :size='isMobile ? "sm" : "md"',
    :icon-only='isMobile',
    :aria-label='$t("capital.allocateFundsButton.label")',
    @click='open = true'
  )
    template(#icon-left)
      q-icon(name='savings', size='18px')
    template(v-if='!isMobile', #default)
      | {{ $t('capital.allocateFundsButton.label') }}
    q-tooltip(v-if='isMobile') {{ $t('capital.allocateFundsButton.label') }}

  AllocateFundsDialog(
    v-model='open',
    :options='allocationTargets',
    :available='freePool',
    @allocated='onAllocated'
  )
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useWindowSize } from 'src/shared/hooks';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import type { BaseSelectOption } from 'src/shared/ui/base/BaseSelect';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { reloadProgramFunds } from '../../reloadProgramFunds';
import { useConfigStore } from 'app/extensions/capital/entities/Config/model';
import AllocateFundsDialog from './AllocateFundsDialog.vue';

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

// Суммы перечитываются сразу после ответа мутации (reloadProgramFunds).
const onAllocated = reloadProgramFunds;
</script>
