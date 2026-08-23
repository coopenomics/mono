<template lang="pug">
span(@click.stop)
  BaseButton(
    variant='ghost',
    size='sm',
    aria-label='Вернуть средства в программу',
    @click='open = true'
  )
    template(#icon-left)
      q-icon(name='undo', size='16px')
    | Вернуть
  q-tooltip Вернуть средства компонента в программу

  DeallocateFundsDialog(
    v-model='open',
    :project-hash='projectHash',
    :component-title='componentTitle',
    @deallocated='onDeallocated'
  )
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { useConfigStore } from 'app/extensions/capital/entities/Config/model';
import DeallocateFundsDialog from './DeallocateFundsDialog.vue';

defineProps<{
  projectHash: string;
  componentTitle: string;
}>();

const system = useSystemStore();
const projectStore = useProjectStore();
const configStore = useConfigStore();

const open = ref(false);

/** Parser → PG обычно отстаёт от блока на 1–3с; ранний refetch вернёт прежние суммы. */
const POST_CHAIN_REFETCH_MS = 3500;

let refetchTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Перечитываем сторы молча: страница читает их реактивно и обновит суммы сама,
 * не подменяя готовую таблицу заглушкой загрузки.
 */
function onDeallocated(): void {
  refetchTimer = setTimeout(() => {
    const coopname = system.info.coopname;
    void projectStore.loadProjects({
      filter: { coopname, is_component: false },
      options: { page: 1, limit: 100, sortOrder: 'ASC' },
    });
    void configStore.loadState({ coopname });
  }, POST_CHAIN_REFETCH_MS);
}

onBeforeUnmount(() => {
  if (refetchTimer) clearTimeout(refetchTimer);
});
</script>
