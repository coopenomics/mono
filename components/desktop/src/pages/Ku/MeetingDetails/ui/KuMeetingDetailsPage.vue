<template lang="pug">
.q-pa-md
  //- Канон back-link под шапкой — возврат к списку собраний
  button.ku-back(type='button', @click='goBack')
    q-icon(name='arrow_back', size='18px')
    span {{ $t('ku.kuMeetingDetailsPage.backLink') }}

  TableSkeleton(v-if='loading && !decision', :columns='skeletonColumns', :rows='6')
  template(v-else-if='decision')
    .row.q-col-gutter-md
      .col-12.col-md-6
        BaseCard(:title='$t("ku.kuMeetingDetailsPage.meetingCardTitle")')
          template(#actions)
            BaseBadge(:variant='statusMeta.variant') {{ statusMeta.label }}
          DataRow(:label='$t("ku.kuMeetingDetailsPage.meetingPlaceLabel")', :value='decision.meet_place || "—"')
          DataRow(:label='$t(`ku.kuMeetingDetailsPage.meetingTimeLabel`, { timezone: timezoneLabel })', :value='formatDate(decision.meet_at)')
          //- организатор собрания автоматически является его председателем
          DataRow(:label='$t("ku.kuMeetingDetailsPage.meetingOrganizerLabel")', :value='organizerName')
          DataRow(
            v-if='isVotingStarted',
            :label='$t("ku.kuMeetingDetailsPage.meetingBranchNameLabel")',
            :value='decision.branch_name || "—"'
          )
          DataRow(v-if='isVotingStarted', :label='$t("ku.kuMeetingDetailsPage.meetingAddressLabel")', :value='decision.address || "—"')
          DataRow(
            v-if='isVotingStarted && decision.branch_email',
            :label='$t("ku.kuMeetingDetailsPage.meetingEmailLabel")',
            :value='decision.branch_email'
          )
          DataRow(
            v-if='isVotingStarted && decision.branch_phone',
            :label='$t("ku.kuMeetingDetailsPage.meetingPhoneLabel")',
            :value='decision.branch_phone'
          )
          DataRow(v-if='isVotingStarted', :label='$t("ku.kuMeetingDetailsPage.meetingChairmanLabel")', :value='chairmanName')
          DataRow(
            v-if='isVotingWindow',
            :label='$t(`ku.kuMeetingDetailsPage.votingUntilLabel`, { timezone: timezoneLabel })',
            :value='formatDate(decision.close_at)'
          )
          DataRow(v-if='isVotingStarted', :label='$t("ku.kuMeetingDetailsPage.ballotsCountLabel")', :value='String(decision.signed_ballots ?? 0)')

      .col-12.col-md-6
        BaseCard(:title='$t("ku.kuMeetingDetailsPage.participantsTitle")')
          template(v-if='participantsInfo.length')
            .row.q-gutter-xs.q-pa-sm
              BaseBadge(
                v-for='participant in participantsInfo',
                :key='participant.username',
                :variant='participant.username === decision.chairman ? "pos" : "neutral"'
              ) {{ participant.display_name }}{{ participant.username === decision.chairman ? $t('ku.kuMeetingDetailsPage.participantChairmanSuffix') : '' }}
          EmptyState(v-else, :title='$t("ku.kuMeetingDetailsPage.participantsEmpty")')

    //- Повестка и голосование (канон meet-agenda-card);
    //- по завершении собрания вопросы стираются контрактом — повестка живёт в протоколе
    BaseCard.q-mt-md(v-if='questions.length')
      template(#head)
        .agenda-head
          q-icon.agenda-head__icon(name='list_alt', size='20px')
          div
            .agenda-head__title {{ $t('ku.kuMeetingDetailsPage.agendaTitle') }}
            .agenda-head__sub {{ $t('ku.kuMeetingDetailsPage.agendaSubtitle') }}
      .agenda-items
        .agenda-card(v-for='question in questions', :key='question.id')
          .agenda-card__head
            AgendaNumberAvatar(:number='question.number ?? ""')
            span.agenda-card__title {{ question.title }}
          .agenda-card__decision
            span.agenda-card__label {{ $t('ku.kuMeetingDetailsPage.agendaDecisionLabel') }}
            span.agenda-card__value {{ question.decision }}
          .agenda-card__field(v-if='question.context')
            span.agenda-card__label {{ $t('ku.kuMeetingDetailsPage.agendaContextLabel') }}
            span.agenda-card__value {{ question.context }}
          .agenda-card__vote(v-if='canVote')
            span.agenda-card__label {{ $t('ku.kuMeetingDetailsPage.agendaYourVoteLabel') }}
            .row.items-center.q-gutter-md
              q-radio(v-model='votes[question.id]', val='for', :label='$t("ku.kuMeetingDetailsPage.agendaVoteFor")', dense)
              q-radio(v-model='votes[question.id]', val='against', :label='$t("ku.kuMeetingDetailsPage.agendaVoteAgainst")', dense)
              q-radio(v-model='votes[question.id]', val='abstained', :label='$t("ku.kuMeetingDetailsPage.agendaVoteAbstain")', dense)
          //- итоги показываем только после открытия голосования — до него нули не информативны
          .agenda-card__results(v-else-if='isVotingStarted')
            span.agenda-card__label {{ $t('ku.kuMeetingDetailsPage.agendaResultsTitle') }}
            .row.items-center.q-gutter-sm.q-mt-xs
              BaseBadge(variant='pos') {{ $t('ku.kuMeetingDetailsPage.agendaResultsFor', { votesFor: question.counter_votes_for ?? 0 }) }}
              BaseBadge(variant='neg') {{ $t('ku.kuMeetingDetailsPage.agendaResultsAgainst', { votesAgainst: question.counter_votes_against ?? 0 }) }}
              BaseBadge(variant='neutral') {{ $t('ku.kuMeetingDetailsPage.agendaResultsAbstained', { votesAbstained: question.counter_votes_abstained ?? 0 }) }}
      .row.justify-end.q-mt-md(v-if='canVote')
        BaseButton(
          variant='primary',
          :disabled='!allVoted',
          :loading='busy',
          @click='onVote'
        ) {{ $t('ku.kuMeetingDetailsPage.agendaVoteSubmit') }}

    //- Публикуемые документы собрания: протокол собрания пайщиков и решение совета.
    //- Договор матответственности и доверенность здесь не публикуются (паспортные данные).
    BaseCard.q-mt-md(v-if='protocolDoc || authorizationDoc')
      template(#head)
        .agenda-head
          q-icon.agenda-head__icon(name='description', size='20px')
          div
            .agenda-head__title {{ $t('ku.kuMeetingDetailsPage.documentsTitle') }}
            .agenda-head__sub {{ $t('ku.kuMeetingDetailsPage.documentsSubtitle') }}
      .column.q-gutter-sm
        DocumentRow(
          v-if='protocolDoc',
          :document='{ type: "html", title: $t("ku.kuMeetingDetailsPage.protocolDocTitle") }',
          @open='openMeetingDoc(protocolDoc, $t("ku.kuMeetingDetailsPage.protocolDocTitle"))'
        )
        DocumentRow(
          v-if='authorizationDoc',
          :document='{ type: "html", title: $t("ku.kuMeetingDetailsPage.authorizationDocTitle") }',
          @open='openMeetingDoc(authorizationDoc, $t("ku.kuMeetingDetailsPage.authorizationDocTitle"))'
        )

  EmptyState(v-else, :title='$t("ku.kuMeetingDetailsPage.meetingNotFound")')

//- Открытие голосования: организатор фиксирует решения собрания —
//- наименование/адрес участка и председателя из числа участников
BaseDialog(v-model='isStartOpen', :title='$t("ku.kuMeetingDetailsPage.startDialogTitle")', size='md')
  BaseForm(@submit='onStart')
    .t-sm.t-muted.q-mb-md
      | {{ $t('ku.kuMeetingDetailsPage.startDialogNotice') }}
    template(v-if='isCreateBranchType')
      BaseInput(
        v-model='startForm.branchName',
        :label='$t("ku.kuMeetingDetailsPage.startBranchNameLabel")',
        :placeholder='$t("ku.kuMeetingDetailsPage.startBranchNamePlaceholder")',
        required
      )
      BaseInput(
        v-model='startForm.address',
        :label='$t("ku.kuMeetingDetailsPage.startAddressLabel")',
        :placeholder='$t("ku.kuMeetingDetailsPage.startAddressPlaceholder")',
        required
      )
      //- контакты нужны для добавления участка как подразделения после решения совета
      BaseInput(
        v-model='startForm.branchEmail',
        :label='$t("ku.kuMeetingDetailsPage.startEmailLabel")',
        type='email',
        placeholder='uchastok@example.ru',
        required
      )
      BaseInput(
        v-model='startForm.branchPhone',
        :label='$t("ku.kuMeetingDetailsPage.startPhoneLabel")',
        placeholder='+7 900 000-00-00',
        required
      )
      BaseSelect(
        v-model='startForm.chairman',
        :label='$t("ku.kuMeetingDetailsPage.startChairmanLabel")',
        :options='participantOptions',
        :hint='$t("ku.kuMeetingDetailsPage.startChairmanHint")',
        required
      )

    //- Повестку можно расширить вопросами, внесёнными прямо на собрании
    .t-sm.t-muted.q-mt-md(v-if='extraAgenda.length') {{ $t('ku.kuMeetingDetailsPage.extraAgendaTitle') }}
    .q-mt-sm(v-for='(point, index) in extraAgenda', :key='index')
      .row.items-start.q-gutter-sm
        .col
          BaseInput(v-model='point.title', :label='$t(`ku.kuMeetingDetailsPage.extraQuestionLabel`, { questionNumber: index + 1 })', required)
          BaseInput(v-model='point.decision', :label='$t("ku.kuMeetingDetailsPage.agendaDecisionLabel")', required)
        button.icon-btn.q-mt-sm(type='button', :aria-label='$t("ku.kuMeetingDetailsPage.removeQuestionAria")', @click='removeAgendaPoint(index)')
          q-icon(name='close')
    BaseButton.q-mt-sm(variant='secondary', size='sm', type='button', @click='addAgendaPoint') {{ $t('ku.kuMeetingDetailsPage.addQuestionButton') }}

    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant='secondary', type='button', @click='isStartOpen = false') {{ $t('ku.kuMeetingDetailsPage.startCancelButton') }}
      BaseButton(
        variant='primary',
        type='submit',
        :disabled='isCreateBranchType && !startForm.chairman',
        :loading='busy'
      ) {{ $t('common.action.open') }}

//- Отмена собрания
BaseDialog(v-model='isCancelOpen', :title='$t("ku.kuMeetingDetailsPage.cancelDialogTitle")', size='sm')
  BaseForm(@submit='onCancel')
    BaseInput(v-model='cancelReason', :label='$t("ku.kuMeetingDetailsPage.cancelReasonLabel")', required)
    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant='secondary', type='button', @click='isCancelOpen = false') {{ $t('common.action.back') }}
      BaseButton(variant='primary', type='submit', :loading='busy') {{ $t('ku.kuMeetingDetailsPage.cancelDialogTitle') }}

//- Просмотр публикуемого документа собрания (протокол собрания / решение совета)
BaseDialog(v-model='isDocOpen', :title='docTitle', size='lg')
  BaseDocument(v-if='docTarget', :document-aggregate='docTarget')

//- Предпросмотр пакета документов с данными пайщика перед подписанием и отправкой в совет
BaseDialog(v-model='execPreviewOpen', :title='$t("ku.kuMeetingDetailsPage.execPreviewTitle")', size='lg')
  .t-sm.t-muted.q-mb-md
    | {{ $t('ku.kuMeetingDetailsPage.execPreviewNoticeLine1') }}
    | {{ $t('ku.kuMeetingDetailsPage.execPreviewNoticeLine2') }}
  .column.q-gutter-md
    .ku-preview-doc(v-for='item in execPreviewDocs', :key='item.title')
      .ku-preview-doc__title {{ item.title }}
      BaseDocument(:document-aggregate='item.aggregate')
  .row.justify-end.q-gutter-sm.q-mt-md
    BaseButton(variant='secondary', type='button', @click='execPreviewOpen = false') {{ $t('common.action.back') }}
    BaseButton(variant='primary', :loading='busy', @click='confirmExec') {{ $t('ku.kuMeetingDetailsPage.execPreviewSubmit') }}

//- Сбор паспорта председателя участка перед направлением договора в совет (если паспорта ещё нет)
CollectPassportDialog(v-model='passportDialogOpen', @saved='onPassportSaved')
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { useKuStore, KU_LIVE_TABLES } from 'src/entities/Ku/model';
import { useLiveReload } from 'src/shared/lib/realtime';
import type { IDocumentAggregate } from 'src/entities/Document/model';
import { useKuDecisionFlow } from 'src/features/Ku/DecisionFlow/model';
import type { KuVote } from 'src/features/Ku/DecisionFlow/model';
import { CollectPassportDialog, useRequirePassport } from 'src/features/User/CollectPassport';
import { useSessionStore } from 'src/entities/Session';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import {
  BaseBadge,
  BaseButton,
  BaseCard,
  BaseDialog,
  BaseForm,
  BaseInput,
  BaseSelect,
  EmptyState,
  TableSkeleton,
} from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base';
import { DataRow, DocumentRow } from 'src/shared/ui/domain';
import { BaseDocument } from 'src/shared/ui/BaseDocument';
import { AgendaNumberAvatar } from 'src/shared/ui/AgendaNumberAvatar';
import { useHeaderActions } from 'src/shared/hooks';
import { formatDateToLocalTimezone, getTimezoneLabel } from 'src/shared/lib/utils/dates/timezone';
import { kuMeetingHeaderActions } from '../model/header-actions-store';
import KuMeetingHeaderActions from './KuMeetingHeaderActions.vue';
import { t } from 'src/shared/i18n';

const route = useRoute();
const router = useRouter();
const kuStore = useKuStore();
const session = useSessionStore();
const desktop = useDesktopStore();
const system = useSystemStore();
const flow = useKuDecisionFlow();
const { passportDialogOpen, requirePassport, onPassportSaved } = useRequirePassport();

const loading = ref(true);
// busy охватывает транзакцию вместе с ожиданием обновления проекции —
// лоадер на кнопке снимается только когда страница реально обновилась
const busy = ref(false);
const isStartOpen = ref(false);
const isCancelOpen = ref(false);
const cancelReason = ref('');
// просмотр публикуемого документа собрания (протокол собрания / решение совета)
const isDocOpen = ref(false);
const docTarget = ref<IDocumentAggregate | null>(null);
const docTitle = ref('');
// предпросмотр пакета документов председателя перед подписанием и отправкой в совет
const execPreviewOpen = ref(false);
const execPreparedDocs = ref<Awaited<ReturnType<typeof flow.prepareExecDocuments>> | null>(null);
const votes = ref<Record<number, KuVote>>({});
const startForm = ref({ branchName: '', address: '', branchEmail: '', branchPhone: '', chairman: '' });
// вопросы, внесённые в повестку прямо на собрании (добавляются при открытии голосования)
const extraAgenda = ref<{ title: string; decision: string; context: string }[]>([]);

function addAgendaPoint() {
  extraAgenda.value.push({ title: '', decision: '', context: '' });
}

function removeAgendaPoint(index: number) {
  extraAgenda.value.splice(index, 1);
}

const hash = computed(() => String(route.params.hash));
const decision = computed(() => kuStore.currentDecision);

const skeletonColumns: TableSkeletonColumn[] = [{ label: t('ku.kuMeetingDetailsPage.skeletonParamColumn') }, { label: t('ku.kuMeetingDetailsPage.skeletonValueColumn') }];

const participants = computed(() => decision.value?.participants ?? []);

// Участники с отображаемыми именами (ФИО) — пайщики выбираются по имени, не по username
const participantsInfo = computed(
  () =>
    (decision.value?.participants_info ?? []).filter(Boolean) as {
      username: string;
      display_name: string;
      account_type?: Zeus.AccountType;
    }[],
);

function displayName(username?: string | null): string {
  if (!username) return '—';
  return participantsInfo.value.find((participant) => participant.username === username)?.display_name ?? username;
}

const organizerName = computed(() => displayName(decision.value?.initiator));
const chairmanName = computed(() => displayName(decision.value?.chairman));

// id вопроса нормализуем в number: голоса индексируются по нему
const questions = computed(() =>
  (decision.value?.questions ?? []).map((question) => ({ ...question, id: Number(question.id ?? 0) })),
);

// публикуемые документы собрания (агрегаты с html+подписями) — приходят с бэкенда
const protocolDoc = computed(() => decision.value?.protocol_document ?? null);
const authorizationDoc = computed(() => decision.value?.authorization_document ?? null);

function openMeetingDoc(aggregate: IDocumentAggregate, title: string): void {
  docTarget.value = aggregate;
  docTitle.value = title;
  isDocOpen.value = true;
}

// сгенерированные (ещё не подписанные) документы оборачиваем в агрегат для BaseDocument:
// html уже есть, подписей пока нет
const execPreviewDocs = computed(() => {
  const d = execPreparedDocs.value;
  if (!d) return [];
  // неподписанный сгенерированный документ: реальных подписей и хэшей ещё нет —
  // оборачиваем в минимальный агрегат для предпросмотра (BaseDocument рендерит rawDocument)
  const wrap = (gen: object, title: string) => ({
    title,
    aggregate: { rawDocument: gen, document: { doc_hash: '', signatures: [] } } as unknown as IDocumentAggregate,
  });
  return [
    wrap(d.petition, t('ku.kuMeetingDetailsPage.docPetitionTitle')),
    wrap(d.liability, t('ku.kuMeetingDetailsPage.docLiabilityTitle')),
    wrap(d.authority, t('ku.kuMeetingDetailsPage.docAuthorityTitle')),
  ];
});

const participantOptions = computed(() =>
  participantsInfo.value
    .filter((participant) => participant.account_type === Zeus.AccountType.individual)
    .map((participant) => ({
      label: participant.display_name,
      value: participant.username,
    })),
);

watchEffect(() => {
  if (!startForm.value.chairman) return;
  const isEligible = participantOptions.value.some((option) => option.value === startForm.value.chairman);
  if (!isEligible) startForm.value.chairman = '';
});

const statusMap: Record<Zeus.KuDecisionStatus, { label: string; variant: 'neutral' | 'pos' | 'neg' | 'warn' | 'info' }> = {
  [Zeus.KuDecisionStatus.OPENED]: { label: t('ku.kuMeetingDetailsPage.status.opened'), variant: 'info' },
  [Zeus.KuDecisionStatus.VOTING]: { label: t('ku.kuMeetingDetailsPage.status.voting'), variant: 'warn' },
  [Zeus.KuDecisionStatus.APPROVED]: { label: t('ku.kuMeetingDetailsPage.status.approved'), variant: 'pos' },
  [Zeus.KuDecisionStatus.ONAPPROVAL]: { label: t('ku.kuMeetingDetailsPage.status.onApproval'), variant: 'info' },
  [Zeus.KuDecisionStatus.COMPLETED]: { label: t('ku.kuMeetingDetailsPage.status.completed'), variant: 'neutral' },
  [Zeus.KuDecisionStatus.CANCELLED]: { label: t('ku.kuMeetingDetailsPage.status.cancelled'), variant: 'neg' },
};

const status = computed(() => decision.value?.status ?? null);

const statusMeta = computed(() => {
  // для стёртых записей backend сам различает completed/cancelled
  return (status.value && statusMap[status.value]) ?? { label: status.value || '—', variant: 'neutral' as const };
});

const isCreateBranchType = computed(() => decision.value?.type === Zeus.KuDecisionType.CREATEBRANCH);

const isParticipant = computed(() => participants.value.includes(session.username));
// контракт требует не менее 3 участников для открытия голосования (MIN_DECISION_QUORUM)
const hasQuorum = computed(() => participants.value.length >= 3);
const isInitiator = computed(() => decision.value?.initiator === session.username);
// избранный собранием председатель кооперативного участка — он подписывает заявление в совет
const isElectedChairman = computed(() => !!decision.value?.chairman && decision.value.chairman === session.username);
const isLive = computed(() => decision.value?.present !== false);

const isVotingWindow = computed(() => status.value === Zeus.KuDecisionStatus.VOTING);
const isVotingStarted = computed(() => !!status.value && status.value !== Zeus.KuDecisionStatus.OPENED);

const canJoin = computed(() => isLive.value && status.value === Zeus.KuDecisionStatus.OPENED && !isParticipant.value);
// Голосование открывает организатор собрания, назначая председателя из участников
const canStart = computed(() => isLive.value && status.value === Zeus.KuDecisionStatus.OPENED && isInitiator.value);
// тикающее «сейчас» — чтобы кнопка протокола ожила по истечении окна голосования без перезагрузки
const nowTick = ref(Date.now());
let nowTimer: ReturnType<typeof setInterval> | undefined;
// Живое собрание: старт голосования, смена статуса и новые бюллетени приходят
// по ленте изменений (прежде — опрос раз в 15 секунд). Во время своего
// действия не перечитываем — withReload сделает это по ответу.
useLiveReload(KU_LIVE_TABLES, () => {
  if (busy.value) return;
  return refreshDecision();
});

// регламент closedec: протокол утверждается после голосования всех участников либо по истечении окна
const canCloseNow = computed(() => {
  const allVoted = (decision.value?.signed_ballots ?? 0) >= participants.value.length;
  const closeAt = decision.value?.close_at ? new Date(decision.value.close_at).getTime() : 0;
  const windowPassed = closeAt > 0 && nowTick.value > closeAt;
  return allVoted || windowPassed;
});
// заявление в совет подписывает избранный председатель кооперативного участка,
// а не председатель собрания — кнопка появляется у него после утверждения протокола
const canExec = computed(
  () =>
    isLive.value &&
    status.value === Zeus.KuDecisionStatus.APPROVED &&
    isElectedChairman.value &&
    decision.value?.type === Zeus.KuDecisionType.CREATEBRANCH,
);
// повестка принята: подан хотя бы один бюллетень и по каждому вопросу «за» больше «против»
const votingAccepted = computed(
  () =>
    (decision.value?.signed_ballots ?? 0) > 0 &&
    questions.value.length > 0 &&
    questions.value.every(
      (question) => Number(question.counter_votes_for ?? 0) > Number(question.counter_votes_against ?? 0),
    ),
);

// протокол утверждает организатор (председатель собрания) — только после окончания голосования
// и при принятой повестке (по каждому вопросу «за» больше «против», см. closedec + votingAccepted)
const canClose = computed(
  () =>
    isLive.value &&
    status.value === Zeus.KuDecisionStatus.VOTING &&
    isInitiator.value &&
    canCloseNow.value &&
    votingAccepted.value,
);

// отмена на этапе сбора участников; после окончания голосования — только если повестка не принята
const canCancel = computed(() => {
  if (!isLive.value || !isInitiator.value || !status.value) return false;
  if (status.value === Zeus.KuDecisionStatus.OPENED) return true;
  if (status.value === Zeus.KuDecisionStatus.VOTING) return canCloseNow.value && !votingAccepted.value;
  return false;
});

const hasVoted = computed(() =>
  questions.value.some(
    (question) =>
      question.voters_for?.includes(session.username) ||
      question.voters_against?.includes(session.username) ||
      question.voters_abstained?.includes(session.username),
  ),
);

const canVote = computed(
  () => isLive.value && status.value === Zeus.KuDecisionStatus.VOTING && isParticipant.value && !hasVoted.value,
);

const allVoted = computed(() => questions.value.every((question) => votes.value[question.id]));

const timezoneLabel = getTimezoneLabel();

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return formatDateToLocalTimezone(value) || '—';
}

/**
 * Перечитать собрание. Действие отвечает, когда узел разобрал его блок и
 * проекция в базе уже новая, — поэтому одно чтение, без циклов ожидания; всё,
 * что придёт позже (голоса других участников), принесёт лента изменений.
 */
async function refreshDecision(): Promise<void> {
  try {
    await kuStore.loadDecision(hash.value);
  } catch {
    // записи ещё нет в проекции — её принесёт сигнал ленты
  }
}

async function withReload(action: () => Promise<void>, successMessage: string) {
  busy.value = true;
  try {
    await action();
    await refreshDecision();
    SuccessAlert(successMessage);
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

const onJoin = () =>
  withReload(
    () => flow.joinDecision(decision.value!),
    t('ku.kuMeetingDetailsPage.successJoined'),
  );
const onClose = () =>
  withReload(
    () => flow.closeDecision(decision.value!),
    t('ku.kuMeetingDetailsPage.status.approved'),
  );
// перед направлением в совет: собираем паспорт (если в реестре его ещё нет) →
// генерируем пакет документов с подставленными данными → показываем на прочтение.
// Подпись и отправка происходят только после подтверждения в окне предпросмотра.
const onExec = () =>
  requirePassport(async () => {
    busy.value = true;
    try {
      execPreparedDocs.value = await flow.prepareExecDocuments(decision.value!);
      execPreviewOpen.value = true;
    } catch (e: unknown) {
      FailAlert(e);
    } finally {
      busy.value = false;
    }
  });

async function confirmExec(): Promise<void> {
  if (!execPreparedDocs.value) return;
  execPreviewOpen.value = false;
  await withReload(
    () => flow.execDecision(decision.value!, execPreparedDocs.value!),
    t('ku.kuMeetingDetailsPage.successSentToCouncil'),
  );
  execPreparedDocs.value = null;
}
const onVote = () => {
  return withReload(
    () => flow.voteOnDecision(decision.value!, votes.value),
    t('ku.kuMeetingDetailsPage.successBallotSubmitted'),
  );
};

async function onStart() {
  isStartOpen.value = false;
  const extra = extraAgenda.value.filter((point) => point.title.trim() && point.decision.trim());
  // итоговая повестка заменяет предварительную: формулировки уточняются решениями собрания
  // (наименование участка, избранный председатель) — в таком виде они попадут в протокол
  let agenda: { title: string; decision: string; context: string }[];
  if (isCreateBranchType.value) {
    const branchName = startForm.value.branchName.trim();
    const chairmanFullName = displayName(startForm.value.chairman);
    // принадлежность участка кооперативу указывается в каждом вопросе (требование методолога):
    // «...кооперативного участка «Петрушка» потребительского кооператива «Восход»»
    const coopName = system.info?.vars?.name ?? '';
    const coopGenitive = system.info?.vars?.full_abbr_genitive ?? t('ku.kuMeetingDetailsPage.defaultCoopGenitive');
    const coopSuffix = coopName ? ` ${coopGenitive} «${coopName}»` : '';
    const councilTarget = coopName ? t('ku.kuMeetingDetailsPage.councilNameTemplate', { coopGenitive, coopName }) : t('ku.kuMeetingDetailsPage.defaultCouncilName');
    agenda = [
      {
        title: t('ku.kuMeetingDetailsPage.agendaQuestion1Title', { branchName, coopSuffix }),
        decision: t('ku.kuMeetingDetailsPage.agendaQuestion1Decision', { branchName, coopSuffix, address: startForm.value.address.trim() }),
        context: '',
      },
      {
        // полномочие обратиться в совет входит во второй вопрос — отдельного третьего вопроса нет
        title: t('ku.kuMeetingDetailsPage.agendaQuestion2Title', { branchName, coopSuffix }),
        decision: t('ku.kuMeetingDetailsPage.agendaQuestion2Decision', { branchName, coopSuffix, chairmanName: chairmanFullName, chairmanNameRepeat: chairmanFullName, councilTarget }),
        context: '',
      },
      ...extra,
    ];
  } else {
    // произвольное собрание: без доп. вопросов повестка не меняется (пустой список)
    agenda = extra.length
      ? [
          ...questions.value.map((question) => ({
            title: question.title ?? '',
            decision: question.decision ?? '',
            context: question.context ?? '',
          })),
          ...extra,
        ]
      : [];
  }
  await withReload(
    () =>
      flow.startDecision(decision.value!, {
        // для собрания по произвольным вопросам отдельный председатель участка не избирается —
        // собрание ведёт организатор (председатель собрания)
        chairman: isCreateBranchType.value ? startForm.value.chairman : session.username,
        address: isCreateBranchType.value ? startForm.value.address : '',
        branchName: isCreateBranchType.value ? startForm.value.branchName : '',
        branchEmail: isCreateBranchType.value ? startForm.value.branchEmail.trim() : '',
        branchPhone: isCreateBranchType.value ? startForm.value.branchPhone.trim() : '',
        agenda,
      }),
    t('ku.kuMeetingDetailsPage.successVotingOpened'),
  );
  extraAgenda.value = [];
}

async function onCancel() {
  isCancelOpen.value = false;
  await withReload(
    () => flow.cancelDecision(decision.value!, cancelReason.value),
    t('ku.kuMeetingDetailsPage.successMeetingCancelled'),
  );
}

const { registerAction } = useHeaderActions();

// действия собрания живут в шапке страницы (канон header actions);
// состояние пробрасывается через module-ref, т.к. шапка вне поддерева страницы
watchEffect(() => {
  kuMeetingHeaderActions.value = {
    canJoin: canJoin.value,
    canStart: canStart.value,
    hasQuorum: hasQuorum.value,
    canClose: canClose.value,
    canExec: canExec.value,
    canCancel: canCancel.value,
    busy: busy.value,
    onJoin,
    onStartOpen: () => (isStartOpen.value = true),
    onClose,
    onExec,
    onCancelOpen: () => (isCancelOpen.value = true),
  };
});

onMounted(async () => {
  registerAction({ id: 'ku-meeting-actions', component: KuMeetingHeaderActions, order: 1 });
  // timing: ui — часы для кнопки протокола: окно голосования закрывается по времени, событий нет.
  nowTimer = setInterval(() => (nowTick.value = Date.now()), 10000);
  loading.value = true;
  try {
    // Объявление собрания отвечает после разбора своего блока — участники уже в
    // проекции; всё, что догонит позже, принесёт лента изменений.
    await refreshDecision();
    const loaded = decision.value;
    if (loaded) {
      startForm.value.address = loaded.address || '';
      startForm.value.branchName = loaded.branch_name || '';
      startForm.value.branchEmail = loaded.branch_email || '';
      startForm.value.branchPhone = loaded.branch_phone || '';
      desktop.setPageTitleOverride(
        t('ku.kuMeetingDetailsPage.pageTitle', { meetingLabel: loaded.branch_name || loaded.meet_place || loaded.hash.slice(0, 8) }),
      );
    }
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  desktop.clearPageTitleOverride();
  kuMeetingHeaderActions.value = null;
  if (nowTimer) clearInterval(nowTimer);
});

// Возврат к списку собраний (back-link под шапкой, канон meet-back)
function goBack(): void {
  void router.push({ name: 'ku-meetings', params: { coopname: route.params.coopname } });
}
</script>

<style scoped>
.agenda-head {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2, 8px);
}
.agenda-head__icon {
  color: var(--p-ink-2);
  margin-top: 2px;
}
.agenda-head__title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  letter-spacing: var(--p-ls-h3);
  color: var(--p-ink);
}
.agenda-head__sub {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
  margin-top: 2px;
}
.agenda-items {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}
.agenda-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  padding: var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}
.agenda-card__head {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3, 12px);
}
.agenda-card__title {
  font-size: var(--p-fs-body, 14px);
  font-weight: 600;
  line-height: 1.4;
  color: var(--p-ink-1);
  padding-top: 6px;
  overflow-wrap: anywhere;
}
.agenda-card__field,
.agenda-card__results {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.agenda-card__decision {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--p-3, 12px);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}
.agenda-card__vote {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}
.agenda-card__label {
  font-size: var(--p-fs-meta, 12px);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--p-ink-3);
}
.agenda-card__value {
  font-size: var(--p-fs-body, 14px);
  line-height: 1.5;
  color: var(--p-ink-1);
  overflow-wrap: anywhere;
}

.ku-preview-doc__title {
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
  color: var(--p-ink-2);
  margin-bottom: var(--p-2, 8px);
}

.ku-back {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  margin-bottom: var(--p-4, 16px);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  cursor: pointer;
  transition: color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.ku-back:hover {
  color: var(--p-ink);
}
</style>
