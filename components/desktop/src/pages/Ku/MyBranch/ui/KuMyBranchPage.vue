<template lang="pug">
.q-pa-md
  .banner.banner--info.q-mb-md(v-if='!dismissed')
    q-icon.banner__icon(name='info', size='20px')
    .banner__body
      | Кооперативные участки объединяют пайщиков по месту. Здесь видны участки
      | кооператива, их председатели и доверенные лица. Сменить свой участок можно
      | заявлением о выборе участка.
    button.icon-btn(type='button', aria-label='Скрыть', @click='dismiss')
      q-icon(name='close')

  TableSkeleton(v-if='loading && !branches.length', :columns='3', :rows='4')
  .row.q-col-gutter-md(v-else-if='branches.length')
    .col-12.col-md-6(v-for='branch in branches', :key='branch.braname')
      BaseCard(:title='branchTitle(branch)')
        DataRow(label='Имя аккаунта участка', :value='branch.braname')
        DataRow(label='Председатель участка', :value='branch.trustee?.username || "—"')
        .q-pa-sm(v-if='myRole(branch)')
          BaseBadge(variant='pos') {{ myRole(branch) }}
  EmptyState(
    v-else,
    title='Кооперативных участков пока нет',
    body='Учредите участок собранием пайщиков на вкладке «Собрания».'
  )
    template(#icon)
      q-icon(name='home_work', size='48px')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useBranchStore } from 'src/entities/Branch/model';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useDismissibleBanner } from 'src/shared/hooks/useDismissibleBanner';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, BaseCard, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';

const branchStore = useBranchStore();
const system = useSystemStore();
const session = useSessionStore();
const { dismissed, dismiss } = useDismissibleBanner('ku:my-branch:banner-dismissed');

const loading = ref(true);

const branches = computed(() => branchStore.branches);

function branchTitle(branch: any): string {
  return branch.short_name || branch.full_name || branch.braname;
}

function myRole(branch: any): string | null {
  if (branch.trustee?.username === session.username) return 'Вы — председатель участка';
  if ((branch.trusted || []).some((trusted: any) => (trusted?.username || trusted) === session.username)) {
    return 'Вы — доверенное лицо участка';
  }
  return null;
}

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
