<template lang="pug">
.q-pa-md
  .banner.banner--info.q-mb-md(v-if='!dismissed')
    q-icon.banner__icon(name='info', size='20px')
    .banner__body
      | Кооперативные участки объединяют пайщиков по месту. Откройте участок,
      | чтобы увидеть его председателя, адрес, контакты и доверенных лиц.
      | Новый участок учреждается собранием пайщиков на вкладке «Собрания».
    button.icon-btn(type='button', aria-label='Скрыть', @click='dismiss')
      q-icon(name='close')

  TableSkeleton(v-if='loading && !branches.length', :columns='skeletonColumns', :rows='4')
  .table-wrap(v-else-if='branches.length')
    .table-scroll
      table.table
        thead
          tr
            th Участок
            th Председатель
            th.t-num Доверенных
            th.col-action
        tbody
          tr.data-row(
            v-for='branch in branches',
            :key='branch.braname',
            @click='openDetails(branch.braname)'
          )
            td
              .doc-primary {{ branchTitle(branch) }}
              .t-sm.t-muted(v-if='branch.fact_address') {{ branch.fact_address }}
            td {{ chairmanName(branch) }}
            td.t-num {{ (branch.trusted || []).length }}
            td.col-action
              button.icon-btn(
                type='button',
                aria-label='Открыть участок',
                @click.stop='openDetails(branch.braname)'
              )
                q-icon(name='chevron_right')
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
import { useRouter } from 'vue-router';
import { useBranchStore } from 'src/entities/Branch/model';
import { useSystemStore } from 'src/entities/System/model';
import { useDismissibleBanner } from 'src/shared/hooks/useDismissibleBanner';
import { FailAlert } from 'src/shared/api';
import { EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base';

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Участок' },
  { label: 'Председатель' },
  { label: 'Доверенных', class: 't-num' },
  { label: '', class: 'col-action', cell: 'icon' },
];

const router = useRouter();
const branchStore = useBranchStore();
const system = useSystemStore();
const { dismissed, dismiss } = useDismissibleBanner('ku:branches:banner-dismissed');

const loading = ref(true);

const branches = computed(() => branchStore.branches);

function branchTitle(branch: any): string {
  return branch.short_name || branch.full_name || branch.braname;
}

function chairmanName(branch: any): string {
  const trustee = branch.trustee;
  if (!trustee) return '—';
  return [trustee.last_name, trustee.first_name, trustee.middle_name].filter(Boolean).join(' ') || trustee.username;
}

function openDetails(braname: string) {
  router.push({ name: 'ku-branch-details', params: { coopname: system.info.coopname, braname } });
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

<style scoped>
/* строка ведёт на страницу участка — показываем кликабельность */
.data-row {
  cursor: pointer;
}
</style>
