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

  TableSkeleton(v-if='loading && !decisions.length', :columns='6', :rows='5')
  .table-wrap(v-else-if='decisions.length')
    .table-scroll
      table.table
        thead
          tr
            th Участок
            th Статус
            th Инициатор
            th Председатель
            th.t-num Участники
            th.t-num Бюллетени
        tbody
          tr.data-row(
            v-for='decision in decisions',
            :key='decision.hash',
            @click='openDetails(decision.hash)'
          )
            td
              .doc-primary {{ decision.braname || '—' }}
              .t-sm.t-muted(v-if='decision.address') {{ decision.address }}
            td
              BaseBadge(:variant='statusMeta(decision).variant') {{ statusMeta(decision).label }}
            td {{ decision.initiator }}
            td {{ decision.chairman || '—' }}
            td.t-num {{ decision.participants?.length || 0 }}
            td.t-num {{ decision.signed_ballots || 0 }}
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
      v-model='form.braname',
      label='Имя аккаунта участка',
      mono,
      placeholder='например: branchone',
      hint='12 символов: a-z и 1-5',
      required
    )
    BaseInput(
      v-model='form.address',
      label='Адрес привязки участка',
      placeholder='город, улица, дом',
      required
    )
    BaseInput(
      v-model='form.chairmanCandidate',
      label='Кандидат в председатели участка',
      mono,
      hint='Имя аккаунта пайщика; по умолчанию — вы',
    )
    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant='secondary', type='button', @click='isCreateOpen = false') Отменить
      BaseButton(variant='primary', type='submit', :loading='isSubmitting') Подписать и объявить
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useKuStore } from 'src/entities/Ku/model';
import type { IKuDecision } from 'src/entities/Ku/model';
import { useKuDecisionFlow } from 'src/features/Ku/DecisionFlow/model';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useHeaderActions } from 'src/shared/hooks';
import { useDismissibleBanner } from 'src/shared/hooks/useDismissibleBanner';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import { CreateKuMeetingButton } from '../../shared/CreateKuMeetingButton';

const router = useRouter();
const kuStore = useKuStore();
const system = useSystemStore();
const session = useSessionStore();
const flow = useKuDecisionFlow();
const { registerAction } = useHeaderActions();
const { dismissed, dismiss } = useDismissibleBanner('ku:meetings:banner-dismissed');

const loading = ref(true);
const isCreateOpen = ref(false);
const isSubmitting = computed(() => flow.isSubmitting.value);

const form = ref({
  braname: '',
  address: '',
  chairmanCandidate: '',
});

const decisions = computed(() => kuStore.decisions);

const statusMap: Record<string, { label: string; variant: 'neutral' | 'pos' | 'neg' | 'warn' | 'info' }> = {
  opened: { label: 'Сбор участников', variant: 'info' },
  voting: { label: 'Голосование', variant: 'warn' },
  approved: { label: 'Протокол утверждён', variant: 'pos' },
  onapproval: { label: 'На утверждении советом', variant: 'info' },
  completed: { label: 'Завершено', variant: 'neutral' },
};

function statusMeta(decision: IKuDecision) {
  return statusMap[decision.status as string] ?? { label: decision.status || '—', variant: 'neutral' as const };
}

function openDetails(hash: string) {
  router.push({ name: 'ku-meeting-details', params: { coopname: system.info.coopname, hash } });
}

function openCreateDialog() {
  form.value = { braname: '', address: '', chairmanCandidate: '' };
  isCreateOpen.value = true;
}

async function submitCreate() {
  try {
    const chairmanCandidate = form.value.chairmanCandidate || session.username;
    const hash = await flow.createDecision({
      type: 'createbranch',
      braname: form.value.braname,
      address: form.value.address,
      chairmanCandidate,
      agenda: [
        {
          title: `Об организации кооперативного участка «${form.value.braname}»`,
          decision: `Организовать кооперативный участок «${form.value.braname}» с привязкой к адресу: ${form.value.address}`,
          context: '',
        },
        {
          title: 'Об избрании председателя кооперативного участка',
          decision: `Избрать председателем кооперативного участка пайщика ${chairmanCandidate}`,
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
