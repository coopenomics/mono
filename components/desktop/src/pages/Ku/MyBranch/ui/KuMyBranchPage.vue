<template lang="pug">
.q-pa-md
  TableSkeleton(v-if='loading', :columns='skeletonColumns', :rows='3')
  //- страница моего участка — тот же виджет, что и у страницы участка из списка
  KuBranchDetailsWidget(v-else-if='myBraname', :braname='myBraname')
  EmptyState(
    v-else,
    title='Вы не являетесь председателем кооперативного участка',
    body='Здесь появится ваш участок, когда вы будете избраны его председателем. Участки кооператива — на вкладке «Кооперативные участки», учреждение нового — на вкладке «Собрания».'
  )
    template(#icon)
      q-icon(name='home_work', size='48px')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useBranchStore } from 'src/entities/Branch/model';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert } from 'src/shared/api';
import { EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base';
import { KuBranchDetailsWidget } from 'src/widgets/Ku/BranchDetails';

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Участок' },
  { label: 'Председатель' },
  { label: 'Доверенные' },
];

const branchStore = useBranchStore();
const system = useSystemStore();
const session = useSessionStore();

const loading = ref(true);

const myBraname = computed(() => {
  const branch = branchStore.branches.find((item: any) => item.trustee?.username === session.username) as any;
  return branch?.braname ?? '';
});

onMounted(async () => {
  loading.value = true;
  try {
    await branchStore.loadBranches({ coopname: system.info.coopname });
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
});
</script>
