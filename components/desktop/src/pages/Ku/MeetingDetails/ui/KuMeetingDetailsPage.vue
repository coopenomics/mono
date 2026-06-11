<template lang="pug">
.q-pa-md
  TableSkeleton(v-if='loading && !decision', :columns='skeletonColumns', :rows='6')
  template(v-else-if='decision')
    //- Статус + главные действия по статусу и роли
    .row.items-center.q-mb-md
      BaseBadge(:variant='statusMeta.variant') {{ statusMeta.label }}
      q-space
      .row.q-gutter-sm
        BaseButton(
          v-if='canJoin',
          variant='primary',
          size='sm',
          :loading='isSubmitting',
          @click='onJoin'
        ) Присоединиться
        BaseButton(
          v-if='canStart',
          variant='primary',
          size='sm',
          :loading='isSubmitting',
          @click='isStartOpen = true'
        ) Открыть голосование
        BaseButton(
          v-if='canClose',
          variant='primary',
          size='sm',
          :loading='isSubmitting',
          @click='onClose'
        ) Завершить и утвердить протокол
        BaseButton(
          v-if='canExec',
          variant='primary',
          size='sm',
          :loading='isSubmitting',
          @click='onExec'
        ) Направить в совет
        BaseButton(
          v-if='canCancel',
          variant='secondary',
          size='sm',
          :loading='isSubmitting',
          @click='isCancelOpen = true'
        ) Отменить собрание

    .row.q-col-gutter-md
      .col-12.col-md-6
        BaseCard(title='Собрание')
          DataRow(label='Адрес участка', :value='decision.address || "—"')
          DataRow(label='Инициатор', :value='decision.initiator || "—"')
          DataRow(label='Председатель собрания', :value='decision.chairman || "—"')
          DataRow(label='Открытие голосования', :value='formatDate(decision.open_at)')
          DataRow(label='Закрытие голосования', :value='formatDate(decision.close_at)')
          DataRow(label='Бюллетеней подано', :value='String(decision.signed_ballots ?? 0)')

      .col-12.col-md-6
        BaseCard(title='Участники собрания')
          template(v-if='participants.length')
            .row.q-gutter-xs.q-pa-sm
              BaseBadge(
                v-for='participant in participants',
                :key='participant',
                :variant='participant === decision.chairman ? "pos" : "neutral"'
              ) {{ participant }}{{ participant === decision.chairman ? ' (председатель)' : '' }}
            .q-pa-sm(v-if='canSetChairman')
              BaseSelect(
                v-model='chairmanCandidate',
                label='Назначить председателя собрания',
                :options='participantOptions'
              )
              BaseButton.q-mt-sm(
                variant='secondary',
                size='sm',
                :disabled='!chairmanCandidate',
                :loading='isSubmitting',
                @click='onSetChairman'
              ) Назначить
          EmptyState(v-else, title='Пока никто не присоединился')

    //- Повестка и голосование
    BaseCard.q-mt-md(title='Повестка дня')
      .q-pa-sm(v-for='question in questions', :key='question.id')
        .doc-primary {{ question.number }}. {{ question.title }}
        .t-sm.t-muted.q-mb-xs(v-if='question.context') {{ question.context }}
        .t-sm Проект решения: {{ question.decision }}
        .row.items-center.q-gutter-md.q-mt-xs
          template(v-if='canVote')
            q-radio(
              v-model='votes[question.id]',
              val='for',
              label='За',
              dense
            )
            q-radio(
              v-model='votes[question.id]',
              val='against',
              label='Против',
              dense
            )
            q-radio(
              v-model='votes[question.id]',
              val='abstained',
              label='Воздержался',
              dense
            )
          template(v-else)
            BaseBadge(variant='pos') За: {{ question.counter_votes_for ?? 0 }}
            BaseBadge(variant='neg') Против: {{ question.counter_votes_against ?? 0 }}
            BaseBadge(variant='neutral') Воздержались: {{ question.counter_votes_abstained ?? 0 }}
        q-separator.q-mt-sm
      .q-pa-sm(v-if='canVote')
        BaseButton(
          variant='primary',
          :disabled='!allVoted',
          :loading='isSubmitting',
          @click='onVote'
        ) Подписать бюллетень

  EmptyState(v-else, title='Собрание не найдено')

//- Открытие голосования
BaseDialog(v-model='isStartOpen', title='Открыть голосование', size='sm')
  BaseForm(@submit='onStart')
    BaseInput(v-model='startForm.address', label='Адрес привязки участка', required)
    BaseInput(v-model='startForm.openAt', label='Открытие', type='date', required)
    BaseInput(v-model='startForm.closeAt', label='Закрытие', type='date', required)
    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant='secondary', type='button', @click='isStartOpen = false') Отменить
      BaseButton(variant='primary', type='submit', :loading='isSubmitting') Открыть

//- Отмена собрания
BaseDialog(v-model='isCancelOpen', title='Отменить собрание', size='sm')
  BaseForm(@submit='onCancel')
    BaseInput(v-model='cancelReason', label='Причина отмены', required)
    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant='secondary', type='button', @click='isCancelOpen = false') Назад
      BaseButton(variant='primary', type='submit', :loading='isSubmitting') Отменить собрание
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { useKuStore } from 'src/entities/Ku/model';
import type { IKuDecision } from 'src/entities/Ku/model';
import { useKuDecisionFlow } from 'src/features/Ku/DecisionFlow/model';
import type { KuVote } from 'src/features/Ku/DecisionFlow/model';
import { useSessionStore } from 'src/entities/Session';
import { useDesktopStore } from 'src/entities/Desktop/model';
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
import { DataRow } from 'src/shared/ui/domain';

const route = useRoute();
const kuStore = useKuStore();
const session = useSessionStore();
const desktop = useDesktopStore();
const flow = useKuDecisionFlow();

const loading = ref(true);
const isStartOpen = ref(false);
const isCancelOpen = ref(false);
const cancelReason = ref('');
const chairmanCandidate = ref<string | null>(null);
const votes = ref<Record<number, KuVote>>({});
const startForm = ref({ address: '', openAt: '', closeAt: '' });

const hash = computed(() => String(route.params.hash));
const decision = computed(() => kuStore.currentDecision);
const isSubmitting = computed(() => flow.isSubmitting.value);

const skeletonColumns: TableSkeletonColumn[] = [{ label: 'Параметр' }, { label: 'Значение' }];

const participants = computed(() => decision.value?.participants ?? []);
// id вопроса нормализуем в number: голоса индексируются по нему
const questions = computed(() =>
  (decision.value?.questions ?? []).map((question) => ({ ...question, id: Number(question.id ?? 0) })),
);

const participantOptions = computed(() =>
  participants.value.map((participant) => ({ label: participant, value: participant })),
);

const statusMap: Record<Zeus.KuDecisionStatus, { label: string; variant: 'neutral' | 'pos' | 'neg' | 'warn' | 'info' }> = {
  [Zeus.KuDecisionStatus.OPENED]: { label: 'Сбор участников', variant: 'info' },
  [Zeus.KuDecisionStatus.VOTING]: { label: 'Голосование', variant: 'warn' },
  [Zeus.KuDecisionStatus.APPROVED]: { label: 'Протокол утверждён', variant: 'pos' },
  [Zeus.KuDecisionStatus.ONAPPROVAL]: { label: 'На утверждении советом', variant: 'info' },
  [Zeus.KuDecisionStatus.COMPLETED]: { label: 'Завершено', variant: 'neutral' },
};

const status = computed(() => decision.value?.status ?? null);

const statusMeta = computed(
  () => (status.value && statusMap[status.value]) ?? { label: status.value || '—', variant: 'neutral' as const },
);

const isParticipant = computed(() => participants.value.includes(session.username));
const isInitiator = computed(() => decision.value?.initiator === session.username);
const isChairman = computed(() => decision.value?.chairman === session.username);
const isLive = computed(() => decision.value?.present !== false);

const canJoin = computed(() => isLive.value && status.value === Zeus.KuDecisionStatus.OPENED && !isParticipant.value);
const canSetChairman = computed(() => isLive.value && status.value === Zeus.KuDecisionStatus.OPENED && isInitiator.value);
const canStart = computed(() => isLive.value && status.value === Zeus.KuDecisionStatus.OPENED && isChairman.value);
const canClose = computed(() => isLive.value && status.value === Zeus.KuDecisionStatus.VOTING && isChairman.value);
const canExec = computed(
  () =>
    isLive.value &&
    status.value === Zeus.KuDecisionStatus.APPROVED &&
    isChairman.value &&
    decision.value?.type === Zeus.KuDecisionType.CREATEBRANCH,
);
const canCancel = computed(
  () =>
    isLive.value &&
    isInitiator.value &&
    !!status.value &&
    [Zeus.KuDecisionStatus.OPENED, Zeus.KuDecisionStatus.VOTING, Zeus.KuDecisionStatus.APPROVED].includes(status.value),
);

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

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU');
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
  try {
    await action();
    await pollDecision(predicate);
    SuccessAlert(successMessage);
  } catch (e: unknown) {
    FailAlert(e);
  }
}

const onJoin = () =>
  withReload(
    () => flow.joinDecision(decision.value!),
    'Вы присоединились к собранию',
    (d) => (d.participants ?? []).includes(session.username),
  );
const onSetChairman = () => {
  const candidate = chairmanCandidate.value as string;
  return withReload(
    () => flow.setChairman(decision.value!, candidate),
    'Председатель собрания назначен',
    (d) => d.chairman === candidate,
  );
};
const onClose = () =>
  withReload(
    () => flow.closeDecision(decision.value!),
    'Протокол утверждён',
    (d) => d.status === Zeus.KuDecisionStatus.APPROVED,
  );
const onExec = () =>
  withReload(
    () => flow.execDecision(decision.value!),
    'Заявление направлено в совет',
    (d) => d.status === Zeus.KuDecisionStatus.ONAPPROVAL,
  );
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
  await withReload(
    () =>
      flow.startDecision(decision.value!, {
        address: startForm.value.address,
        openAt: new Date(startForm.value.openAt).toISOString(),
        closeAt: new Date(`${startForm.value.closeAt}T23:59:59`).toISOString(),
      }),
    'Голосование открыто',
    (d) => d.status === Zeus.KuDecisionStatus.VOTING,
  );
}

async function onCancel() {
  isCancelOpen.value = false;
  await withReload(
    () => flow.cancelDecision(decision.value!, cancelReason.value),
    'Собрание отменено',
    (d) => d.status === Zeus.KuDecisionStatus.COMPLETED,
  );
}

onMounted(async () => {
  loading.value = true;
  try {
    // после объявления собрания проекция может отставать от блокчейна —
    // ждём появления записи, не показывая ошибку
    await pollDecision(undefined, 15);
    const loaded = decision.value;
    if (loaded) {
      startForm.value.address = loaded.address || '';
      desktop.setPageTitleOverride(`Собрание: ${loaded.address || loaded.hash.slice(0, 8)}`);
    }
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  desktop.clearPageTitleOverride();
});
</script>
