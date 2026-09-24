<template lang="pug">
.q-pa-md
  .banner.banner--info.q-mb-md(v-if='!dismissed')
    q-icon.banner__icon(name='info', size='20px')
    .banner__body
      | {{ $t('ku.kuMeetingsPage.introLine1') }}
      | {{ $t('ku.kuMeetingsPage.introLine2') }}
      | {{ $t('ku.kuMeetingsPage.introLine3') }}
    button.icon-btn(type='button', :aria-label='$t("ku.kuMeetingsPage.dismissBanner")', @click='dismiss')
      q-icon(name='close')

  TableSkeleton(v-if='loading && !decisions.length', :columns='skeletonColumns', :rows='5')
  .table-wrap(v-else-if='decisions.length')
    .table-scroll
      table.table
        thead
          tr
            th {{ $t('ku.kuMeetingsPage.column.branch') }}
            th {{ $t('ku.kuMeetingsPage.column.dateTime', { timezone: timezoneLabel }) }}
            th {{ $t('ku.kuMeetingsPage.column.status') }}
            th.t-num {{ $t('ku.kuMeetingsPage.column.participants') }}
            th.col-action
        tbody
          tr.data-row(
            v-for='decision in decisions',
            :key='decision.hash',
            @click='openDetails(decision.hash)'
          )
            td
              .doc-primary {{ meetingTitle(decision) }}
              .t-sm.t-muted(v-if='decision.meet_place') {{ decision.meet_place }}
            td {{ formatMeetAt(decision.meet_at) }}
            td
              BaseBadge(:variant='statusMeta(decision).variant') {{ statusMeta(decision).label }}
            td.t-num {{ decision.participants?.length || 0 }}
            td.col-action
              button.icon-btn(
                type='button',
                :aria-label='$t("ku.kuMeetingsPage.openMeetingAction")',
                @click.stop='openDetails(decision.hash)'
              )
                q-icon(name='chevron_right')
  EmptyState(
    v-else,
    :title='$t("ku.kuMeetingsPage.emptyTitle")',
    :body='$t("ku.kuMeetingsPage.emptyBody")'
  )
    template(#icon)
      q-icon(name='groups', size='48px')

BaseDialog(v-model='isCreateOpen', :title='$t("ku.kuMeetingsPage.createDialogTitle")', size='md')
  BaseForm(@submit='submitCreate')
    BaseSelect(
      v-model='form.type',
      :label='$t("ku.kuMeetingsPage.typeLabel")',
      :options='meetingTypeOptions',
      required
    )
    BaseInput(
      v-model='form.meetPlace',
      :label='$t("ku.kuMeetingsPage.placeLabel")',
      :placeholder='$t("ku.kuMeetingsPage.placePlaceholder")',
      required
    )
    BaseInput(
      v-model='form.meetAt',
      :label='$t(`ku.kuMeetingsPage.dateTimeLabel`, { timezone: timezoneLabel })',
      type='datetime-local',
      required
    )

    template(v-if='form.type === "createbranch"')
      .t-sm.t-muted.q-my-md
        | {{ $t('ku.kuMeetingsPage.createBranchAgendaHintLine1') }}
        | {{ $t('ku.kuMeetingsPage.createBranchAgendaHintLine2') }}
        | {{ $t('ku.kuMeetingsPage.createBranchAgendaHintLine3') }}
    template(v-else)
      .t-sm.t-muted.q-my-md
        | {{ $t('ku.kuMeetingsPage.freeAgendaHintLine1') }}
        | {{ $t('ku.kuMeetingsPage.freeAgendaHintLine2') }}
      .q-mb-sm(v-for='(point, index) in freeAgenda', :key='index')
        .row.items-start.q-gutter-sm
          .col
            BaseInput(v-model='point.title', :label='$t(`ku.kuMeetingsPage.agendaQuestionLabel`, { number: index + 1 })', required)
            BaseInput(v-model='point.decision', :label='$t("ku.kuMeetingsPage.decisionDraftLabel")', required)
          button.icon-btn.q-mt-sm(
            v-if='freeAgenda.length > 1',
            type='button',
            :aria-label='$t("ku.kuMeetingsPage.removeQuestionAction")',
            @click='removeFreeAgendaPoint(index)'
          )
            q-icon(name='close')
      BaseButton.q-mt-sm(variant='secondary', size='sm', type='button', @click='addFreeAgendaPoint') {{ $t('ku.kuMeetingsPage.addQuestionAction') }}

    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant='secondary', type='button', @click='isCreateOpen = false') {{ $t('ku.kuMeetingsPage.cancelCreateAction') }}
      BaseButton(variant='primary', type='submit', :loading='isSubmitting') {{ $t('ku.kuMeetingsPage.submitCreateAction') }}
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
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
import {
  BaseBadge,
  BaseButton,
  BaseDialog,
  BaseForm,
  BaseInput,
  BaseSelect,
  EmptyState,
  TableSkeleton,
} from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base';
import { CreateKuMeetingButton } from '../../shared/CreateKuMeetingButton';
import { t } from 'src/shared/i18n';

const router = useRouter();
const kuStore = useKuStore();
const system = useSystemStore();
const flow = useKuDecisionFlow();
const { registerAction } = useHeaderActions();
const { dismissed, dismiss } = useDismissibleBanner('ku:meetings:banner-dismissed');

const loading = ref(true);
const isCreateOpen = ref(false);
const isSubmitting = computed(() => flow.isSubmitting.value);

const form = ref<{ type: 'createbranch' | 'free'; meetPlace: string; meetAt: string }>({
  type: 'createbranch',
  meetPlace: '',
  meetAt: '',
});

const meetingTypeOptions = [
  { label: t('ku.kuMeetingsPage.meetingTypeOption.createBranch'), value: 'createbranch' },
  { label: t('ku.kuMeetingsPage.meetingTypeOption.free'), value: 'free' },
];

// повестка собрания по произвольным вопросам — задаётся организатором
const freeAgenda = ref<{ title: string; decision: string; context: string }[]>([
  { title: '', decision: '', context: '' },
]);

function addFreeAgendaPoint() {
  freeAgenda.value.push({ title: '', decision: '', context: '' });
}

function removeFreeAgendaPoint(index: number) {
  freeAgenda.value.splice(index, 1);
}

const decisions = computed(() => kuStore.decisions);

const skeletonColumns: TableSkeletonColumn[] = [
  { label: t('ku.kuMeetingsPage.column.branch') },
  { label: t('ku.kuMeetingsPage.column.dateTimeSkeleton') },
  { label: t('ku.kuMeetingsPage.column.status'), cell: 'badge' },
  { label: t('ku.kuMeetingsPage.column.participants'), class: 't-num' },
  { label: '', class: 'col-action', cell: 'icon' },
];

const statusMap: Record<Zeus.KuDecisionStatus, { label: string; variant: 'neutral' | 'pos' | 'neg' | 'warn' | 'info' }> = {
  [Zeus.KuDecisionStatus.OPENED]: { label: t('ku.kuMeetingsPage.status.opened'), variant: 'info' },
  [Zeus.KuDecisionStatus.VOTING]: { label: t('ku.kuMeetingsPage.status.voting'), variant: 'warn' },
  [Zeus.KuDecisionStatus.APPROVED]: { label: t('ku.kuMeetingsPage.status.approved'), variant: 'pos' },
  [Zeus.KuDecisionStatus.ONAPPROVAL]: { label: t('ku.kuMeetingsPage.status.onApproval'), variant: 'info' },
  [Zeus.KuDecisionStatus.COMPLETED]: { label: t('ku.kuMeetingsPage.status.completed'), variant: 'neutral' },
  [Zeus.KuDecisionStatus.CANCELLED]: { label: t('ku.kuMeetingsPage.status.cancelled'), variant: 'neg' },
};

function statusMeta(decision: IKuDecision) {
  // для стёртых записей backend сам различает completed/cancelled
  return (
    (decision.status && statusMap[decision.status]) ?? { label: decision.status || '—', variant: 'neutral' as const }
  );
}

function meetingTitle(decision: IKuDecision): string {
  if (decision.type === Zeus.KuDecisionType.FREE) return t('ku.kuMeetingsPage.defaultMeetingTitle');
  return decision.branch_name || decision.address || t('ku.kuMeetingsPage.branchEstablishmentTitle');
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
  form.value = { type: 'createbranch', meetPlace: '', meetAt: '' };
  freeAgenda.value = [{ title: '', decision: '', context: '' }];
  isCreateOpen.value = true;
}

// предварительная повестка собрания об учреждении кооперативного участка.
// Наименование участка и председатель ещё не известны — итоговые формулировки с
// именем участка и кооператива подставляются при открытии голосования (см. startdec).
function buildCreateBranchAgenda() {
  const coopName = system.info?.vars?.name ?? '';
  const coopGenitive = system.info?.vars?.full_abbr_genitive ?? t('ku.kuMeetingsPage.coopGenitiveFallback');
  const coopSuffix = coopName ? ` ${coopGenitive} «${coopName}»` : '';
  const councilTarget = coopName ? t('ku.kuMeetingsPage.councilTargetLabel', { coopGenitive, coopName }) : t('ku.kuMeetingsPage.councilFallbackLabel');
  return [
    {
      title: t('ku.kuMeetingsPage.agendaTitleCreateBranch', { coopSuffix }),
      decision: t('ku.kuMeetingsPage.agendaDecisionCreateBranch', { coopSuffix }),
      context: '',
    },
    {
      // полномочие обратиться в совет входит во второй вопрос — отдельного третьего вопроса нет
      title: t('ku.kuMeetingsPage.agendaTitleElectChairman', { coopSuffix }),
      decision: t('ku.kuMeetingsPage.agendaDecisionElectChairman', { coopSuffix, councilTarget }),
      context: '',
    },
  ];
}

async function submitCreate() {
  const isCreateBranch = form.value.type === 'createbranch';
  const agenda = isCreateBranch
    ? buildCreateBranchAgenda()
    : freeAgenda.value.filter((point) => point.title.trim() && point.decision.trim());
  if (!agenda.length) {
    FailAlert(t('ku.kuMeetingsPage.validationNoAgendaError'));
    return;
  }
  try {
    // braname — служебное имя аккаунта участка, пайщику не показывается
    const hash = await flow.createDecision({
      type: form.value.type,
      braname: isCreateBranch ? generateUsername() : '',
      meetPlace: form.value.meetPlace,
      // ввод формы трактуется в часовом поясе платформы (TIMEZONE), не браузера
      meetAt: convertLocalDateToUTC(form.value.meetAt),
      agenda,
    });
    isCreateOpen.value = false;
    SuccessAlert(t('ku.kuMeetingsPage.meetingAnnouncedSuccess'));
    openDetails(hash);
  } catch (e: unknown) {
    FailAlert(e);
  }
}

// silent=true — фоновое обновление: без скелетона и без алертов об ошибке
async function load(silent = false) {
  if (!silent) loading.value = true;
  try {
    await kuStore.loadDecisions({
      filter: { coopname: system.info.coopname },
      options: { page: 1, limit: 100, sortBy: '_created_at', sortOrder: 'DESC' },
    });
  } catch (e: unknown) {
    if (!silent) FailAlert(e);
  } finally {
    if (!silent) loading.value = false;
  }
}

// фоновое обновление списка (пока нет websocket): новые собрания и смена
// статусов подтягиваются без перезагрузки страницы
let refreshTimer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  registerAction({
    id: 'ku-create-meeting',
    component: CreateKuMeetingButton,
    props: { onClick: openCreateDialog },
    order: 1,
  });
  load();
  refreshTimer = setInterval(() => load(true), 15000);
});

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<style scoped>
/* строка ведёт в карточку собрания — показываем кликабельность */
.data-row {
  cursor: pointer;
}
</style>
