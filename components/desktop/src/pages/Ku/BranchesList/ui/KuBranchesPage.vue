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

  //- Состояние системы управления кооперативом (флаг is_branched из контракта branch):
  //- при 3+ кооперативных участках общее собрание проходит через участки (мажоритарная модель).
  //- Индикатор только для информации — флаг выставляется контрактом автоматически.
  BaseCard.q-mb-md(title='Мажоритарная система управления')
    template(#actions)
      BaseChip(:variant="isBranched ? 'pos' : 'neutral'")
        q-icon(:name="isBranched ? 'check_circle' : 'do_not_disturb_on'", size='14px')
        span.q-ml-xs {{ isBranched ? 'Включена' : 'Не включена' }}
    .t-sm.t-muted {{ branchModeText }}

  TableSkeleton(v-if='loading && !branches.length', :columns='skeletonColumns', :rows='4')
  .table-wrap(v-else-if='branches.length')
    .table-scroll
      table.table
        thead
          tr
            th Участок
            th Председатель
            th Доверенные
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
            td
              template(v-if='trustedNames(branch).length')
                div(v-for='name in trustedNames(branch)', :key='name') {{ name }}
              span(v-else) —
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
import { BaseCard, BaseChip, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base';

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Участок' },
  { label: 'Председатель' },
  { label: 'Доверенные' },
  { label: '', class: 'col-action', cell: 'icon' },
];

const router = useRouter();
const branchStore = useBranchStore();
const system = useSystemStore();
const { dismissed, dismiss } = useDismissibleBanner('ku:branches:banner-dismissed');

const loading = ref(true);

// публичные данные участков (сертификаты с ФИО) — доступны любому пайщику
const branches = computed(() => branchStore.publicBranches);

// состояние системы управления из контракта: is_branched отдаётся системным стором
// (system.info.cooperator_account). Контракт включает флаг при 3+ кооперативных участках.
const isBranched = computed(() => !!system.info?.cooperator_account?.is_branched);
const branchModeText = computed(() =>
  isBranched.value
    ? 'В кооперативе три и более кооперативных участков, поэтому общие собрания проходят через них: пайщики участвуют в собраниях своего участка, а участки представляют их на общем собрании пайщиков кооператива.'
    : 'Пока в кооперативе меньше трёх кооперативных участков — все пайщики участвуют в общем собрании напрямую. Когда участков станет три и более, система управления автоматически переключится на мажоритарную: собрания будут проходить через кооперативные участки.',
);

function branchTitle(branch: any): string {
  return branch.short_name || branch.full_name || branch.braname;
}

function certificateName(certificate: any): string {
  if (!certificate) return '—';
  return (
    [certificate.last_name, certificate.first_name, certificate.middle_name].filter(Boolean).join(' ') ||
    certificate.username
  );
}

function chairmanName(branch: any): string {
  return certificateName(branch.trustee_certificate);
}

function trustedNames(branch: any): string[] {
  return (branch.trusted_certificates ?? []).map((certificate: any) => certificateName(certificate));
}

function openDetails(braname: string) {
  router.push({ name: 'ku-branch-details', params: { coopname: system.info.coopname, braname } });
}

onMounted(async () => {
  loading.value = true;
  try {
    await branchStore.loadPublicBranches({ coopname: system.info.coopname });
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
