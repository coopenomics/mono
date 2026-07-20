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
              .doc-primary {{ meetingTitle(decision) }}
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
    BaseSelect(
      v-model='form.type',
      label='Тип собрания',
      :options='meetingTypeOptions',
      required
    )
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

    template(v-if='form.type === "createbranch"')
      .t-sm.t-muted.q-my-md
        | Повестка стандартная: организация кооперативного участка и избрание его
        | председателя. Решение о месте основания участка и его председателе будет
        | принято на собрании. Место и время собрания видны только пайщикам.
    template(v-else)
      .t-sm.t-muted.q-my-md
        | Повестку определяете вы; на собрании её можно дополнить. Итог собрания —
        | протокол решения пайщиков, в совет ничего не направляется.
      .q-mb-sm(v-for='(point, index) in freeAgenda', :key='index')
        .row.items-start.q-gutter-sm
          .col
            BaseInput(v-model='point.title', :label='`Вопрос ${index + 1}`', required)
            BaseInput(v-model='point.decision', label='Проект решения', required)
          button.icon-btn.q-mt-sm(
            v-if='freeAgenda.length > 1',
            type='button',
            aria-label='Убрать вопрос',
            @click='removeFreeAgendaPoint(index)'
          )
            q-icon(name='close')
      BaseButton.q-mt-sm(variant='secondary', size='sm', type='button', @click='addFreeAgendaPoint') Добавить вопрос

    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant='secondary', type='button', @click='isCreateOpen = false') Отменить
      BaseButton(variant='primary', type='submit', :loading='isSubmitting') Подписать и объявить
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
  { label: 'Создание кооперативного участка', value: 'createbranch' },
  { label: 'Произвольные вопросы', value: 'free' },
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
  [Zeus.KuDecisionStatus.CANCELLED]: { label: 'Отменено', variant: 'neg' },
};

function statusMeta(decision: IKuDecision) {
  // для стёртых записей backend сам различает completed/cancelled
  return (
    (decision.status && statusMap[decision.status]) ?? { label: decision.status || '—', variant: 'neutral' as const }
  );
}

function meetingTitle(decision: IKuDecision): string {
  if (decision.type === Zeus.KuDecisionType.FREE) return 'Собрание пайщиков';
  return decision.branch_name || decision.address || 'Учреждение участка';
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
  const coopGenitive = system.info?.vars?.full_abbr_genitive ?? 'потребительского кооператива';
  const coopSuffix = coopName ? ` ${coopGenitive} «${coopName}»` : '';
  const councilTarget = coopName ? `Совет ${coopGenitive} «${coopName}»` : 'Совет кооператива';
  return [
    {
      title: `Об организации кооперативного участка${coopSuffix}`,
      decision: `Организовать кооперативный участок${coopSuffix} по адресу, определённому собранием пайщиков`,
      context: '',
    },
    {
      // полномочие обратиться в совет входит во второй вопрос — отдельного третьего вопроса нет
      title: `Об избрании председателя кооперативного участка${coopSuffix} и уполномочивании его обратиться в совет`,
      decision: `Избрать председателем кооперативного участка${coopSuffix} пайщика, избранного собранием из числа участников, и уполномочить его обратиться в ${councilTarget} по организации кооперативного участка`,
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
    FailAlert('Добавьте хотя бы один вопрос повестки');
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
    SuccessAlert('Собрание объявлено');
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
