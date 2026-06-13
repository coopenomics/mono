<template lang="pug">
div
  TableSkeleton(v-if='loading && !branch', :columns='skeletonColumns', :rows='3')
  template(v-else-if='branch')
    .row.q-col-gutter-md
      .col-12.col-md-6
        BaseCard(:title='branchTitle')
          DataRow(label='Адрес участка', :value='branch.fact_address || "—"')
          DataRow(label='Email', :value='branch.email || "—"')
          DataRow(label='Телефон', :value='branch.phone || "—"')
        BaseCard.q-mt-md(title='Председатель участка')
          .q-pa-sm
            PersonCard(:person='chairmanPerson')
      .col-12.col-md-6
        BaseCard(title='Доверенные лица')
          template(v-if='trustedPersons.length')
            .q-pa-sm.column.q-gutter-sm
              PersonCard(
                v-for='person in trustedPersons',
                :key='person.accountName',
                :person='person',
                density='compact'
              )
          .q-pa-sm.t-sm.t-muted(v-else)
            | Доверенных лиц пока нет. Пайщик участка становится доверенным по заявлению
            | с договором о полной материальной ответственности — председатель одобряет
            | его встречной подписью (не более трёх доверенных).
          .q-pa-sm(v-if='canRequest')
            BaseButton(
              variant='secondary',
              :loading='isSubmitting',
              @click='onRequest'
            ) Стать доверенным лицом

    //- Заявки пайщиков на приём доверенными лицами этого участка
    BaseCard.q-mt-md(v-if='branchRequests.length', title='Заявки на доверенных')
      .table-wrap
        .table-scroll
          table.table
            thead
              tr
                th Заявитель
                th Статус
                th.col-action Действия
            tbody
              tr(v-for='request in branchRequests', :key='request.hash')
                td
                  .doc-primary {{ requestApplicantName(request) }}
                  .t-sm.t-muted {{ request.username }}
                td
                  BaseBadge(:variant='request.present ? "warn" : "neutral"')
                    | {{ request.present ? 'На рассмотрении' : 'Рассмотрена' }}
                td.col-action
                  .row.q-gutter-xs
                    BaseButton(
                      v-if='request.document?.rawDocument',
                      variant='ghost',
                      size='sm',
                      @click='openDocument(request)'
                    ) Документ
                    template(v-if='request.present && isChairman')
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
  EmptyState(v-else, title='Участок не найден')

//- Просмотр договора заявителя
BaseDialog(v-model='isDocumentOpen', title='Договор о полной материальной ответственности', size='lg')
  BaseDocument(v-if='documentTarget', :document-aggregate='documentTarget')

//- Отклонение заявки доверенного
BaseDialog(v-model='isDeclineOpen', title='Отклонить заявку', size='sm')
  BaseForm(@submit='onDecline')
    BaseInput(v-model='declineReason', label='Причина отклонения', required)
    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant='secondary', type='button', @click='isDeclineOpen = false') Назад
      BaseButton(variant='primary', type='submit', :loading='isSubmitting') Отклонить
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useBranchStore } from 'src/entities/Branch/model';
import { useKuStore } from 'src/entities/Ku/model';
import type { IKuTrustRequest } from 'src/entities/Ku/model';
import { useKuTrustedFlow } from 'src/features/Ku/TrustedFlow/model';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import {
  BaseBadge,
  BaseButton,
  BaseDialog,
  BaseForm,
  BaseInput,
  EmptyState,
  TableSkeleton,
  BaseCard,
} from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base';
import { DataRow, PersonCard } from 'src/shared/ui/domain';
import { BaseDocument } from 'src/shared/ui/BaseDocument';
import type { Person } from 'src/shared/ui/domain/PersonCard';

const props = defineProps<{ braname: string }>();

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Участок' },
  { label: 'Председатель' },
  { label: 'Доверенные' },
];

const branchStore = useBranchStore();
const kuStore = useKuStore();
const system = useSystemStore();
const session = useSessionStore();
const flow = useKuTrustedFlow();

const loading = ref(true);
const isDeclineOpen = ref(false);
const declineReason = ref('');
const declineTarget = ref<IKuTrustRequest | null>(null);
const isDocumentOpen = ref(false);
const documentTarget = ref<object | null>(null);

const isSubmitting = computed(() => flow.isSubmitting.value);

// публичные данные участка (сертификаты с ФИО) — доступны любому пайщику
const branch = computed(
  () => branchStore.publicBranches.find((item: any) => item.braname === props.braname) as any | undefined,
);

const branchTitle = computed(
  () => branch.value?.short_name || branch.value?.full_name || 'Кооперативный участок',
);

function fullName(person?: { last_name?: string; first_name?: string; middle_name?: string } | null): string {
  if (!person) return '—';
  return [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ') || '—';
}

const chairmanPerson = computed<Person>(() => ({
  fullName: fullName(branch.value?.trustee_certificate),
  role: 'Председатель кооперативного участка',
  accountName: branch.value?.trustee_certificate?.username,
}));

const trustedPersons = computed<Person[]>(() =>
  (branch.value?.trusted_certificates ?? []).map((person: any) => ({
    fullName: fullName(person),
    role: 'Доверенное лицо',
    accountName: person?.username,
  })),
);

const isChairman = computed(() => branch.value?.trustee_certificate?.username === session.username);

const branchRequests = computed(() =>
  kuStore.trustRequests.filter((request) => request.braname === props.braname),
);

function requestApplicantName(request: IKuTrustRequest): string {
  return (request as any).display_name || request.username;
}

function openDocument(request: IKuTrustRequest) {
  documentTarget.value = (request as any).document ?? null;
  isDocumentOpen.value = true;
}

// стать доверенным может пайщик участка: не председатель, не доверенный, без активной заявки
const canRequest = computed(() => {
  if (!branch.value || isChairman.value) return false;
  const trusted = branch.value.trusted_certificates ?? [];
  const isTrusted = trusted.some((person: any) => person?.username === session.username);
  const hasActiveRequest = branchRequests.value.some(
    (request) => request.username === session.username && request.present,
  );
  return !isTrusted && !hasActiveRequest && trusted.length < 3;
});

/**
 * Проекции наполняются из блокчейна асинхронно (parser → PG) —
 * после транзакции опрашиваем данные до выполнения предиката.
 */
async function poll(predicate: () => boolean, attempts = 8): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await load();
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function onRequest() {
  try {
    await flow.requestTrusted({
      braname: props.braname,
      branchName: branchTitle.value,
      chairmanFullName: fullName(branch.value?.trustee_certificate),
    });
    SuccessAlert('Заявка подана');
    await poll(() =>
      branchRequests.value.some((request) => request.username === session.username && request.present),
    );
  } catch (e: unknown) {
    FailAlert(e);
  }
}

async function onApprove(request: IKuTrustRequest) {
  try {
    await flow.approveTrusted(request);
    SuccessAlert('Доверенное лицо принято');
    await poll(() => !branchRequests.value.some((item) => item.hash === request.hash && item.present));
  } catch (e: unknown) {
    FailAlert(e);
  }
}

function openDecline(request: IKuTrustRequest) {
  declineTarget.value = request;
  declineReason.value = '';
  isDeclineOpen.value = true;
}

async function onDecline() {
  if (!declineTarget.value) return;
  const target = declineTarget.value;
  try {
    await flow.declineTrusted(target, declineReason.value);
    isDeclineOpen.value = false;
    SuccessAlert('Заявка отклонена');
    await poll(() => !branchRequests.value.some((item) => item.hash === target.hash && item.present));
  } catch (e: unknown) {
    FailAlert(e);
  }
}

async function load() {
  try {
    await Promise.all([
      branchStore.loadPublicBranches({ coopname: system.info.coopname }),
      kuStore.loadTrustRequests({
        filter: { coopname: system.info.coopname, braname: props.braname },
        options: { page: 1, limit: 100, sortBy: '_created_at', sortOrder: 'DESC' },
      }),
    ]);
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.braname,
  () => {
    loading.value = true;
    load();
  },
);

onMounted(load);
</script>
