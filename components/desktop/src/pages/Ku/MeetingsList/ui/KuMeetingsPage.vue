<template lang="pug">
.q-pa-md
  .banner.banner--info.q-mb-md(v-if='!dismissed')
    q-icon.banner__icon(name='info', size='20px')
    .banner__body
      | Любой пайщик может объявить собрание для учреждения кооперативного участка:
      | участники присоединяются по заявлению, голосуют бюллетенями, председатель
      | собрания утверждает протокол, а совет — учреждение участка.
    button.icon-btn(type='button', aria-label='Скрыть', @click='dismiss')
      q-icon(name='close')

  TableSkeleton(v-if='loading && !decisions.length', :columns='skeletonColumns', :rows='5')
  .table-wrap(v-else-if='decisions.length')
    .table-scroll
      table.table
        thead
          tr
            th Участок
            th Дата и время ({{ timezoneLabel }})
            th Статус
            th.t-num Участники
            th.col-action
        tbody
          tr.data-row(
            v-for='decision in decisions',
            :key='decision.hash',
            @click='openDetails(decision.hash)'
          )
            td
              .doc-primary {{ decision.branch_name || decision.address || 'Учреждение участка' }}
              .t-sm.t-muted(v-if='decision.meet_place') {{ decision.meet_place }}
            td {{ formatMeetAt(decision.meet_at) }}
            td
              BaseBadge(:variant='statusMeta(decision).variant') {{ statusMeta(decision).label }}
            td.t-num {{ decision.participants?.length || 0 }}
            td.col-action
              button.icon-btn(
                type='button',
                aria-label='Открыть собрание',
                @click.stop='openDetails(decision.hash)'
              )
                q-icon(name='chevron_right')
  EmptyState(
    v-else,
    title='Собраний пока нет',
    body='Объявите собрание пайщиков, чтобы учредить кооперативный участок.'
  )
    template(#icon)
      q-icon(name='groups', size='48px')

BaseDialog(v-model='isCreateOpen', title='Объявить собрание', size='md')
  BaseForm(@submit='submitCreate')
    BaseInput(
      v-model='form.meetPlace',
      label='Место проведения собрания',
      placeholder='город, улица, дом — или ссылка на онлайн-комнату',
      required
    )
    BaseInput(
      v-model='form.meetAt',
      :label='`Дата и время собрания (${timezoneLabel})`',
      type='datetime-local',
      required
    )
    .t-sm.t-muted.q-mt-sm
      | Решение о месте основания кооперативного участка и его председателе
      | будет принято на собрании. Место и время собрания видны только пайщикам.
    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant='secondary', type='button', @click='isCreateOpen = false') Отменить
      BaseButton(variant='primary', type='submit', :loading='isSubmitting') Подписать и объявить
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { useKuStore } from 'src/entities/Ku/model';
import type { IKuDecision } from 'src/entities/Ku/model';
import { useKuDecisionFlow } from 'src/features/Ku/DecisionFlow/model';
import { useSystemStore } from 'src/entities/System/model';
import { useHeaderActions } from 'src/shared/hooks';
import { useDismissibleBanner } from 'src/shared/hooks/useDismissibleBanner';
import { generateUsername } from 'src/shared/lib/utils/generateUsername';
import {
  convertLocalDateToUTC,
  formatDateToLocalTimezone,
  getTimezoneLabel,
} from 'src/shared/lib/utils/dates/timezone';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base';
import { CreateKuMeetingButton } from '../../shared/CreateKuMeetingButton';

const router = useRouter();
const kuStore = useKuStore();
const system = useSystemStore();
const flow = useKuDecisionFlow();
const { registerAction } = useHeaderActions();
const { dismissed, dismiss } = useDismissibleBanner('ku:meetings:banner-dismissed');

const loading = ref(true);
const isCreateOpen = ref(false);
const isSubmitting = computed(() => flow.isSubmitting.value);

const form = ref({
  meetPlace: '',
  meetAt: '',
});

const decisions = computed(() => kuStore.decisions);

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Участок' },
  { label: 'Дата и время' },
  { label: 'Статус', cell: 'badge' },
  { label: 'Участники', class: 't-num' },
  { label: '', class: 'col-action', cell: 'icon' },
];

const statusMap: Record<Zeus.KuDecisionStatus, { label: string; variant: 'neutral' | 'pos' | 'neg' | 'warn' | 'info' }> = {
  [Zeus.KuDecisionStatus.OPENED]: { label: 'Сбор участников', variant: 'info' },
  [Zeus.KuDecisionStatus.VOTING]: { label: 'Голосование', variant: 'warn' },
  [Zeus.KuDecisionStatus.APPROVED]: { label: 'Протокол утверждён', variant: 'pos' },
  [Zeus.KuDecisionStatus.ONAPPROVAL]: { label: 'На утверждении советом', variant: 'info' },
  [Zeus.KuDecisionStatus.COMPLETED]: { label: 'Завершено', variant: 'neutral' },
};

function statusMeta(decision: IKuDecision) {
  return (
    (decision.status && statusMap[decision.status]) ?? { label: decision.status || '—', variant: 'neutral' as const }
  );
}

const timezoneLabel = getTimezoneLabel();

function formatMeetAt(value?: string | null): string {
  if (!value) return '—';
  return formatDateToLocalTimezone(value) || '—';
}

function openDetails(hash: string) {
  router.push({ name: 'ku-meeting-details', params: { coopname: system.info.coopname, hash } });
}

function openCreateDialog() {
  form.value = { meetPlace: '', meetAt: '' };
  isCreateOpen.value = true;
}

async function submitCreate() {
  try {
    // braname — служебное имя аккаунта участка, пайщику не показывается
    const hash = await flow.createDecision({
      type: 'createbranch',
      braname: generateUsername(),
      meetPlace: form.value.meetPlace,
      // ввод формы трактуется в часовом поясе платформы (TIMEZONE), не браузера
      meetAt: convertLocalDateToUTC(form.value.meetAt),
      agenda: [
        {
          title: 'Об организации кооперативного участка',
          decision: 'Организовать кооперативный участок по адресу привязки, определённому собранием пайщиков',
          context: '',
        },
        {
          title: 'Об избрании председателя кооперативного участка',
          decision: 'Избрать председателем кооперативного участка пайщика, избранного собранием из числа участников',
          context: '',
        },
      ],
    });
    isCreateOpen.value = false;
    SuccessAlert('Собрание объявлено');
    openDetails(hash);
  } catch (e: unknown) {
    FailAlert(e);
  }
}

async function load() {
  loading.value = true;
  try {
    await kuStore.loadDecisions({
      filter: { coopname: system.info.coopname },
      options: { page: 1, limit: 100, sortBy: '_created_at', sortOrder: 'DESC' },
    });
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  registerAction({
    id: 'ku-create-meeting',
    component: CreateKuMeetingButton,
    props: { onClick: openCreateDialog },
    order: 1,
  });
  load();
});
</script>

<style scoped>
/* строка ведёт в карточку собрания — показываем кликабельность */
.data-row {
  cursor: pointer;
}
</style>
