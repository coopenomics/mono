<template lang="pug">
.q-pa-md
  .banner.banner--info.q-mb-md(v-if='!dismissed')
    q-icon.banner__icon(name='info', size='20px')
    .banner__body
      | Пайщик становится доверенным лицом участка по заявлению с договором о полной
      | материальной ответственности. Председатель участка одобряет заявку встречной
      | подписью на договоре (не более трёх доверенных).
    button.icon-btn(type='button', aria-label='Скрыть', @click='dismiss')
      q-icon(name='close')

  TableSkeleton(v-if='loading && !requests.length', :columns='4', :rows='4')
  .table-wrap(v-else-if='requests.length')
    .table-scroll
      table.table
        thead
          tr
            th Участок
            th Заявитель
            th Статус
            th.col-action Действия
        tbody
          tr.data-row(v-for='request in requests', :key='request.hash')
            td {{ request.braname }}
            td {{ request.username }}
            td
              BaseBadge(:variant='request.present ? "warn" : "neutral"')
                | {{ request.present ? 'На рассмотрении' : 'Рассмотрена' }}
            td.col-action
              .row.q-gutter-xs(v-if='request.present && canModerate(request)')
                BaseButton(
                  variant='primary',
                  size='sm',
                  :loading='isSubmitting',
                  @click='onApprove(request)'
                ) Одобрить
                BaseButton(
                  variant='secondary',
                  size='sm',
                  :loading='isSubmitting',
                  @click='openDecline(request)'
                ) Отклонить
              span.t-muted(v-else) —
  EmptyState(
    v-else,
    title='Заявок пока нет',
    body='Подайте заявку, чтобы стать доверенным лицом своего кооперативного участка.'
  )
    template(#icon)
      q-icon(name='handshake', size='48px')

//- Подача заявки доверенного
BaseDialog(v-model='isRequestOpen', title='Стать доверенным лицом', size='sm')
  BaseForm(@submit='onRequest')
    BaseSelect(
      v-model='requestForm.braname',
      label='Кооперативный участок',
      :options='branchOptions',
      required
    )
    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant='secondary', type='button', @click='isRequestOpen = false') Отменить
      BaseButton(variant='primary', type='submit', :loading='isSubmitting') Подписать договор и подать

//- Отклонение заявки
BaseDialog(v-model='isDeclineOpen', title='Отклонить заявку', size='sm')
  BaseForm(@submit='onDecline')
    BaseInput(v-model='declineReason', label='Причина отклонения', required)
    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant='secondary', type='button', @click='isDeclineOpen = false') Назад
      BaseButton(variant='primary', type='submit', :loading='isSubmitting') Отклонить
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useKuStore } from 'src/entities/Ku/model';
import type { IKuTrustRequest } from 'src/entities/Ku/model';
import { useKuTrustedFlow } from 'src/features/Ku/TrustedFlow/model';
import { useBranchStore } from 'src/entities/Branch/model';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useHeaderActions } from 'src/shared/hooks';
import { useDismissibleBanner } from 'src/shared/hooks/useDismissibleBanner';
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
import { RequestKuTrustedButton } from '../../shared/RequestKuTrustedButton';

const kuStore = useKuStore();
const branchStore = useBranchStore();
const system = useSystemStore();
const session = useSessionStore();
const flow = useKuTrustedFlow();
const { registerAction } = useHeaderActions();
const { dismissed, dismiss } = useDismissibleBanner('ku:trust-requests:banner-dismissed');

const loading = ref(true);
const isRequestOpen = ref(false);
const isDeclineOpen = ref(false);
const declineReason = ref('');
const declineTarget = ref<IKuTrustRequest | null>(null);
const requestForm = ref({ braname: '' });

const isSubmitting = computed(() => flow.isSubmitting.value);
const requests = computed(() => kuStore.trustRequests);

const branchOptions = computed(() =>
  branchStore.branches.map((branch: any) => ({
    label: branch.short_name || branch.full_name || branch.braname,
    value: branch.braname,
  })),
);

function canModerate(request: IKuTrustRequest): boolean {
  const branch = branchStore.branches.find((item: any) => item.braname === request.braname) as any;
  return branch?.trustee?.username === session.username;
}

function openDecline(request: IKuTrustRequest) {
  declineTarget.value = request;
  declineReason.value = '';
  isDeclineOpen.value = true;
}

async function onRequest() {
  try {
    const branch = branchStore.branches.find((item: any) => item.braname === requestForm.value.braname) as any;
    await flow.requestTrusted({
      braname: requestForm.value.braname,
      chairmanFullName: branch?.trustee?.username || '',
    });
    isRequestOpen.value = false;
    SuccessAlert('Заявка подана');
    await load();
  } catch (e: unknown) {
    FailAlert(e);
  }
}

async function onApprove(request: IKuTrustRequest) {
  try {
    await flow.approveTrusted(request);
    SuccessAlert('Доверенное лицо принято');
    await load();
  } catch (e: unknown) {
    FailAlert(e);
  }
}

async function onDecline() {
  if (!declineTarget.value) return;
  try {
    await flow.declineTrusted(declineTarget.value, declineReason.value);
    isDeclineOpen.value = false;
    SuccessAlert('Заявка отклонена');
    await load();
  } catch (e: unknown) {
    FailAlert(e);
  }
}

async function load() {
  loading.value = true;
  try {
    await Promise.all([
      kuStore.loadTrustRequests({
        filter: { coopname: system.info.coopname },
        options: { page: 1, limit: 100, sortBy: '_created_at', sortOrder: 'DESC' },
      }),
      branchStore.loadBranches({ coopname: system.info.coopname }),
    ]);
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  registerAction({
    id: 'ku-request-trusted',
    component: RequestKuTrustedButton,
    props: { onClick: () => (isRequestOpen.value = true) },
    order: 1,
  });
  load();
});
</script>
