<template lang="pug">
.q-pa-md
  //- Канон back-link под шапкой — возврат к списку собраний
  button.ku-back(type='button', @click='goBack')
    q-icon(name='arrow_back', size='18px')
    span К списку собраний

  TableSkeleton(v-if='loading && !decision', :columns='skeletonColumns', :rows='6')
  template(v-else-if='decision')
    .row.q-col-gutter-md
      .col-12.col-md-6
        BaseCard(title='Собрание')
          template(#actions)
            BaseBadge(:variant='statusMeta.variant') {{ statusMeta.label }}
          DataRow(label='Место собрания', :value='decision.meet_place || "—"')
          DataRow(:label='`Время собрания (${timezoneLabel})`', :value='formatDate(decision.meet_at)')
          //- организатор собрания автоматически является его председателем
          DataRow(label='Председатель собрания', :value='organizerName')
          DataRow(
            v-if='isVotingStarted',
            label='Наименование участка',
            :value='decision.branch_name || "—"'
          )
          DataRow(v-if='isVotingStarted', label='Адрес участка', :value='decision.address || "—"')
          DataRow(
            v-if='isVotingStarted && decision.branch_email',
            label='Email участка',
            :value='decision.branch_email'
          )
          DataRow(
            v-if='isVotingStarted && decision.branch_phone',
            label='Телефон участка',
            :value='decision.branch_phone'
          )
          DataRow(v-if='isVotingStarted', label='Председатель участка', :value='chairmanName')
          DataRow(
            v-if='isVotingWindow',
            :label='`Голосование открыто до (${timezoneLabel})`',
            :value='formatDate(decision.close_at)'
          )
          DataRow(v-if='isVotingStarted', label='Бюллетеней подано', :value='String(decision.signed_ballots ?? 0)')

      .col-12.col-md-6
        BaseCard(title='Участники собрания')
          template(v-if='participantsInfo.length')
            .row.q-gutter-xs.q-pa-sm
              BaseBadge(
                v-for='participant in participantsInfo',
                :key='participant.username',
                :variant='participant.username === decision.chairman ? "pos" : "neutral"'
              ) {{ participant.display_name }}{{ participant.username === decision.chairman ? ' (председатель участка)' : '' }}
          EmptyState(v-else, title='Пока никто не присоединился')

    //- Повестка и голосование (канон meet-agenda-card);
    //- по завершении собрания вопросы стираются контрактом — повестка живёт в протоколе
    BaseCard.q-mt-md(v-if='questions.length')
      template(#head)
        .agenda-head
          q-icon.agenda-head__icon(name='list_alt', size='20px')
          div
            .agenda-head__title Повестка собрания
            .agenda-head__sub Вопросы и проекты решений, вынесенные на голосование
      .agenda-items
        .agenda-card(v-for='question in questions', :key='question.id')
          .agenda-card__head
            AgendaNumberAvatar(:number='question.number ?? ""')
            span.agenda-card__title {{ question.title }}
          .agenda-card__decision
            span.agenda-card__label Проект решения
            span.agenda-card__value {{ question.decision }}
          .agenda-card__field(v-if='question.context')
            span.agenda-card__label Контекст
            span.agenda-card__value {{ question.context }}
          .agenda-card__vote(v-if='canVote')
            span.agenda-card__label Ваш голос
            .row.items-center.q-gutter-md
              q-radio(v-model='votes[question.id]', val='for', label='За', dense)
              q-radio(v-model='votes[question.id]', val='against', label='Против', dense)
              q-radio(v-model='votes[question.id]', val='abstained', label='Воздержался', dense)
          //- итоги показываем только после открытия голосования — до него нули не информативны
          .agenda-card__results(v-else-if='isVotingStarted')
            span.agenda-card__label Итоги голосования
            .row.items-center.q-gutter-sm.q-mt-xs
              BaseBadge(variant='pos') За: {{ question.counter_votes_for ?? 0 }}
              BaseBadge(variant='neg') Против: {{ question.counter_votes_against ?? 0 }}
              BaseBadge(variant='neutral') Воздержались: {{ question.counter_votes_abstained ?? 0 }}
      .row.justify-end.q-mt-md(v-if='canVote')
        BaseButton(
          variant='primary',
          :disabled='!allVoted',
          :loading='busy',
          @click='onVote'
        ) Подписать бюллетень

    //- Публикуемые документы собрания: протокол собрания пайщиков и решение совета.
    //- Договор матответственности и доверенность здесь не публикуются (паспортные данные).
    BaseCard.q-mt-md(v-if='protocolDoc || authorizationDoc')
      template(#head)
        .agenda-head
          q-icon.agenda-head__icon(name='description', size='20px')
          div
            .agenda-head__title Документы собрания
            .agenda-head__sub Протокол собрания пайщиков и решение совета об организации участка
      .column.q-gutter-sm
        DocumentRow(
          v-if='protocolDoc',
          :document='{ type: "html", title: "Протокол собрания пайщиков" }',
          @open='openMeetingDoc(protocolDoc, "Протокол собрания пайщиков")'
        )
        DocumentRow(
          v-if='authorizationDoc',
          :document='{ type: "html", title: "Решение совета об организации кооперативного участка" }',
          @open='openMeetingDoc(authorizationDoc, "Решение совета об организации кооперативного участка")'
        )

  EmptyState(v-else, title='Собрание не найдено')

//- Открытие голосования: организатор фиксирует решения собрания —
//- наименование/адрес участка и председателя из числа участников
BaseDialog(v-model='isStartOpen', title='Открыть голосование', size='md')
  BaseForm(@submit='onStart')
    .t-sm.t-muted.q-mb-md
      | Голосование продлится 15 минут. Участники собрания получат уведомление.
    template(v-if='isCreateBranchType')
      BaseInput(
        v-model='startForm.branchName',
        label='Наименование кооперативного участка',
        placeholder='например: РОМАШКА',
        required
      )
      BaseInput(
        v-model='startForm.address',
        label='Адрес кооперативного участка',
        placeholder='город, улица, дом',
        required
      )
      //- контакты нужны для добавления участка как подразделения после решения совета
      BaseInput(
        v-model='startForm.branchEmail',
        label='Email кооперативного участка',
        type='email',
        placeholder='uchastok@example.ru',
        required
      )
      BaseInput(
        v-model='startForm.branchPhone',
        label='Телефон кооперативного участка',
        placeholder='+7 900 000-00-00',
        required
      )
      BaseSelect(
        v-model='startForm.chairman',
        label='Председатель кооперативного участка',
        :options='participantOptions',
        hint='Избирается собранием из числа присоединившихся участников',
        required
      )

    //- Повестку можно расширить вопросами, внесёнными прямо на собрании
    .t-sm.t-muted.q-mt-md(v-if='extraAgenda.length') Дополнительные вопросы повестки
    .q-mt-sm(v-for='(point, index) in extraAgenda', :key='index')
      .row.items-start.q-gutter-sm
        .col
          BaseInput(v-model='point.title', :label='`Вопрос ${index + 1}`', required)
          BaseInput(v-model='point.decision', label='Проект решения', required)
        button.icon-btn.q-mt-sm(type='button', aria-label='Убрать вопрос', @click='removeAgendaPoint(index)')
          q-icon(name='close')
    BaseButton.q-mt-sm(variant='secondary', size='sm', type='button', @click='addAgendaPoint') Добавить вопрос в повестку

    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant='secondary', type='button', @click='isStartOpen = false') Отменить
      BaseButton(
        variant='primary',
        type='submit',
        :disabled='isCreateBranchType && !startForm.chairman',
        :loading='busy'
      ) Открыть

//- Отмена собрания
BaseDialog(v-model='isCancelOpen', title='Отменить собрание', size='sm')
  BaseForm(@submit='onCancel')
    BaseInput(v-model='cancelReason', label='Причина отмены', required)
    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant='secondary', type='button', @click='isCancelOpen = false') Назад
      BaseButton(variant='primary', type='submit', :loading='busy') Отменить собрание

//- Просмотр публикуемого документа собрания (протокол собрания / решение совета)
BaseDialog(v-model='isDocOpen', :title='docTitle', size='lg')
  BaseDocument(v-if='docTarget', :document-aggregate='docTarget')

//- Предпросмотр пакета документов с данными пайщика перед подписанием и отправкой в совет
BaseDialog(v-model='execPreviewOpen', title='Проверьте документы перед подписанием', size='lg')
  .t-sm.t-muted.q-mb-md
    | Ознакомьтесь с документами — в них уже подставлены ваши данные. После подписания
    | заявление, договор и доверенность будут направлены в совет.
  .column.q-gutter-md
    .ku-preview-doc(v-for='item in execPreviewDocs', :key='item.title')
      .ku-preview-doc__title {{ item.title }}
      BaseDocument(:document-aggregate='item.aggregate')
  .row.justify-end.q-gutter-sm.q-mt-md
    BaseButton(variant='secondary', type='button', @click='execPreviewOpen = false') Назад
    BaseButton(variant='primary', :loading='busy', @click='confirmExec') Подписать и направить в совет

//- Сбор паспорта председателя участка перед направлением договора в совет (если паспорта ещё нет)
CollectPassportDialog(v-model='passportDialogOpen', @saved='onPassportSaved')
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { useKuStore } from 'src/entities/Ku/model';
import type { IKuDecision } from 'src/entities/Ku/model';
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

const skeletonColumns: TableSkeletonColumn[] = [{ label: 'Параметр' }, { label: 'Значение' }];

const participants = computed(() => decision.value?.participants ?? []);

// Участники с отображаемыми именами (ФИО) — пайщики выбираются по имени, не по username
const participantsInfo = computed(
  () =>
    (decision.value?.participants_info ?? []).filter(Boolean) as { username: string; display_name: string }[],
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
    wrap(d.petition, 'Заявление об учреждении кооперативного участка'),
    wrap(d.liability, 'Договор о полной материальной ответственности'),
    wrap(d.authority, 'Доверенность председателю кооперативного участка'),
  ];
});

const participantOptions = computed(() =>
  participantsInfo.value.map((participant) => ({
    label: participant.display_name,
    value: participant.username,
  })),
);

const statusMap: Record<Zeus.KuDecisionStatus, { label: string; variant: 'neutral' | 'pos' | 'neg' | 'warn' | 'info' }> = {
  [Zeus.KuDecisionStatus.OPENED]: { label: 'Сбор участников', variant: 'info' },
  [Zeus.KuDecisionStatus.VOTING]: { label: 'Голосование', variant: 'warn' },
  [Zeus.KuDecisionStatus.APPROVED]: { label: 'Протокол утверждён', variant: 'pos' },
  [Zeus.KuDecisionStatus.ONAPPROVAL]: { label: 'На утверждении советом', variant: 'info' },
  [Zeus.KuDecisionStatus.COMPLETED]: { label: 'Завершено', variant: 'neutral' },
  [Zeus.KuDecisionStatus.CANCELLED]: { label: 'Отменено', variant: 'neg' },
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
// фоновое обновление состояния собрания (пока нет websocket): старт голосования,
// смена статуса и новые бюллетени подтягиваются без перезагрузки страницы
let refreshTimer: ReturnType<typeof setInterval> | undefined;

// протокол утверждает и направляет в совет председатель собрания — им является организатор
const canClose = computed(() => isLive.value && status.value === Zeus.KuDecisionStatus.VOTING && isInitiator.value);

// регламент: протокол утверждается после голосования всех участников либо по истечении окна
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

// принятое собранием решение организатор отменить не может — только утвердить протокол
// и направить в совет; отмена остаётся при сборе участников и при неуспешном голосовании
const canCancel = computed(() => {
  if (!isLive.value || !isInitiator.value || !status.value) return false;
  if (status.value === Zeus.KuDecisionStatus.OPENED) return true;
  if (status.value === Zeus.KuDecisionStatus.VOTING) return !(canCloseNow.value && votingAccepted.value);
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
 * Проекция собрания наполняется из блокчейна асинхронно (parser → PG),
 * поэтому после транзакции опрашиваем её до выполнения предиката,
 * а при первом открытии — до появления записи.
 */
async function pollDecision(predicate?: (d: IKuDecision) => boolean, attempts = 10): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const loaded = await kuStore.loadDecision(hash.value);
      if (!predicate || predicate(loaded)) return true;
    } catch {
      // записи ещё нет в проекции — ждём следующую попытку
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

async function withReload(
  action: () => Promise<void>,
  successMessage: string,
  predicate?: (d: IKuDecision) => boolean,
) {
  busy.value = true;
  try {
    await action();
    await pollDecision(predicate);
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
    'Вы присоединились к собранию',
    (d) => (d.participants ?? []).includes(session.username),
  );
const onClose = () =>
  withReload(
    () => flow.closeDecision(decision.value!),
    'Протокол утверждён',
    (d) => d.status === Zeus.KuDecisionStatus.APPROVED,
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
    'Заявление направлено в совет',
    (d) => d.status === Zeus.KuDecisionStatus.ONAPPROVAL,
  );
  execPreparedDocs.value = null;
}
const onVote = () => {
  const ballotsBefore = decision.value?.signed_ballots ?? 0;
  return withReload(
    () => flow.voteOnDecision(decision.value!, votes.value),
    'Бюллетень подан',
    (d) => (d.signed_ballots ?? 0) > ballotsBefore,
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
    const coopGenitive = system.info?.vars?.full_abbr_genitive ?? 'потребительского кооператива';
    const coopSuffix = coopName ? ` ${coopGenitive} «${coopName}»` : '';
    const councilTarget = coopName ? `Совет ${coopGenitive} «${coopName}»` : 'Совет кооператива';
    agenda = [
      {
        title: `Об организации кооперативного участка «${branchName}»${coopSuffix}`,
        decision: `Организовать кооперативный участок «${branchName}»${coopSuffix} по адресу: ${startForm.value.address.trim()}`,
        context: '',
      },
      {
        // полномочие обратиться в совет входит во второй вопрос — отдельного третьего вопроса нет
        title: `Об избрании председателя кооперативного участка «${branchName}»${coopSuffix} и уполномочивании его обратиться в совет`,
        decision: `Избрать председателем кооперативного участка «${branchName}»${coopSuffix} ${chairmanFullName} и уполномочить ${chairmanFullName} обратиться в ${councilTarget} по организации кооперативного участка`,
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
    'Голосование открыто',
    (d) => d.status === Zeus.KuDecisionStatus.VOTING,
  );
  extraAgenda.value = [];
}

async function onCancel() {
  isCancelOpen.value = false;
  await withReload(
    () => flow.cancelDecision(decision.value!, cancelReason.value),
    'Собрание отменено',
    (d) => d.status === Zeus.KuDecisionStatus.COMPLETED,
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
    canCloseNow: canCloseNow.value,
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
  nowTimer = setInterval(() => (nowTick.value = Date.now()), 10000);
  // не мешаем активной транзакции — withReload поллит проекцию сам
  refreshTimer = setInterval(() => {
    if (busy.value) return;
    void kuStore.loadDecision(hash.value).catch(() => undefined);
  }, 15000);
  loading.value = true;
  try {
    // после объявления собрания запись появляется сразу (placeholder с местом/временем),
    // но участники приходят из блокчейна асинхронно — ждём полной материализации,
    // иначе организатор увидит пустую страницу без себя в участниках
    await pollDecision((d) => (d.participants ?? []).length > 0, 15);
    const loaded = decision.value;
    if (loaded) {
      startForm.value.address = loaded.address || '';
      startForm.value.branchName = loaded.branch_name || '';
      startForm.value.branchEmail = loaded.branch_email || '';
      startForm.value.branchPhone = loaded.branch_phone || '';
      desktop.setPageTitleOverride(
        `Собрание: ${loaded.branch_name || loaded.meet_place || loaded.hash.slice(0, 8)}`,
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
  if (refreshTimer) clearInterval(refreshTimer);
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
