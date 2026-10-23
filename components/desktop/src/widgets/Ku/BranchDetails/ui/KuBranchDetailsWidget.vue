<template lang="pug">
div
  TableSkeleton(v-if='loading && !branch', :columns='skeletonColumns', :rows='3')
  template(v-else-if='branch')
    .row.q-col-gutter-md
      .col-12.col-md-6
        BaseCard(:title='branchTitle')
          DataRow(:label='$t("ku.kuBranchDetailsWidget.branchAddressLabel")', :value='branch.fact_address || "—"')
          DataRow(label='Email', :value='branch.email || "—"')
          DataRow(:label='$t("ku.kuBranchDetailsWidget.branchPhoneLabel")', :value='branch.phone || "—"')
        BaseCard.q-mt-md(:title='$t("ku.kuBranchDetailsWidget.chairmanCardTitle")')
          .q-pa-sm
            PersonCard(:person='chairmanPerson', density='compact')
      .col-12.col-md-6
        BaseCard(:title='$t("ku.kuBranchDetailsWidget.membersCardTitle")')
          .ku-members
            q-icon.ku-members__icon(name='groups', size='28px')
            .ku-members__body
              .ku-members__count.t-num {{ participantsCount }}
              .ku-members__hint {{ $t('ku.kuBranchDetailsWidget.membersHint') }}
        BaseCard.q-mt-md(:title='$t("ku.kuBranchDetailsWidget.trustedCardTitle")')
          template(v-if='trustedPersons.length')
            .q-pa-sm.column.q-gutter-sm
              PersonCard(
                v-for='person in trustedPersons',
                :key='person.accountName',
                :person='person',
                density='compact'
              )
          .q-pa-sm.t-sm.t-muted(v-else)
            | {{ $t('ku.kuBranchDetailsWidget.trustedEmptyLine1') }}
            | {{ $t('ku.kuBranchDetailsWidget.trustedEmptyLine2') }}
            | {{ $t('ku.kuBranchDetailsWidget.trustedEmptyLine3') }}
          .q-pa-sm(v-if='canRequest')
            BaseButton(
              variant='secondary',
              :loading='isSubmitting',
              @click='onRequest'
            ) {{ $t('ku.kuBranchDetailsWidget.trustedRequestButton') }}

    //- Заявки пайщиков на приём доверенными лицами этого участка
    BaseCard.q-mt-md(v-if='branchRequests.length', :title='$t("ku.kuBranchDetailsWidget.requestsCardTitle")')
      .table-wrap
        .table-scroll
          table.table
            thead
              tr
                th {{ $t('ku.kuBranchDetailsWidget.requestsApplicantColumn') }}
                th {{ $t('ku.kuBranchDetailsWidget.requestsStatusColumn') }}
                th {{ $t('ku.kuBranchDetailsWidget.requestsDocumentsColumn') }}
                th.col-action {{ $t('ku.kuBranchDetailsWidget.requestsActionsColumn') }}
            tbody
              tr(v-for='request in branchRequests', :key='request.hash')
                td
                  .doc-primary {{ requestApplicantName(request) }}
                  .t-sm.t-muted {{ request.username }}
                td
                  BaseBadge(:variant='request.present ? "warn" : "neutral"')
                    | {{ request.present ? $t('ku.kuBranchDetailsWidget.status.pending') : $t('ku.kuBranchDetailsWidget.status.reviewed') }}
                td
                  .ku-doc-links
                    button.ku-doc-link(
                      v-if='request.document?.rawDocument',
                      type='button',
                      @click='openDocument(request)'
                    )
                      q-icon(name='description', size='16px')
                      span {{ $t('ku.kuBranchDetailsWidget.requestsContractLink') }}
                    button.ku-doc-link(
                      v-if='request.authority_document?.rawDocument',
                      type='button',
                      @click='openAuthority(request)'
                    )
                      q-icon(name='description', size='16px')
                      span {{ $t('ku.kuBranchDetailsWidget.requestsAuthorityLink') }}
                    span.t-sm.t-muted(
                      v-if='!request.document?.rawDocument && !request.authority_document?.rawDocument'
                    ) —
                td.col-action
                  .row.q-gutter-xs(v-if='request.present && isChairman')
                    BaseButton(
                      variant='primary',
                      size='sm',
                      :loading='isSubmitting',
                      @click='onApprove(request)'
                    ) {{ $t('ku.kuBranchDetailsWidget.requestsApprove') }}
                    BaseButton(
                      variant='secondary',
                      size='sm',
                      :loading='isSubmitting',
                      @click='openDecline(request)'
                    ) {{ $t('ku.kuBranchDetailsWidget.requestsDecline') }}
  EmptyState(v-else, :title='$t("ku.kuBranchDetailsWidget.branchNotFound")')

//- Просмотр договора заявителя
BaseDialog(v-model='isDocumentOpen', :title='$t("ku.kuBranchDetailsWidget.contractDialogTitle")', size='lg')
  BaseDocument(v-if='documentTarget', :document-aggregate='documentTarget')

//- Просмотр доверенности заявителя
BaseDialog(v-model='isAuthorityOpen', :title='$t("ku.kuBranchDetailsWidget.authorityDialogTitle")', size='lg')
  BaseDocument(v-if='authorityTarget', :document-aggregate='authorityTarget')

//- Предпросмотр документов заявителя с подставленными данными перед подписанием и подачей
BaseDialog(v-model='trustedPreviewOpen', :title='$t("ku.kuBranchDetailsWidget.trustedPreviewTitle")', size='lg')
  .t-sm.t-muted.q-mb-md
    | {{ $t('ku.kuBranchDetailsWidget.trustedPreviewNoticeLine1') }}
    | {{ $t('ku.kuBranchDetailsWidget.trustedPreviewNoticeLine2') }}
  .column.q-gutter-md
    .ku-preview-doc(v-for='item in trustedPreviewDocs', :key='item.title')
      .ku-preview-doc__title {{ item.title }}
      BaseDocument(:document-aggregate='item.aggregate')
  .row.justify-end.q-gutter-sm.q-mt-md
    BaseButton(variant='secondary', type='button', @click='trustedPreviewOpen = false') {{ $t('common.action.back') }}
    BaseButton(variant='primary', :loading='isSubmitting', @click='confirmRequest') {{ $t('ku.kuBranchDetailsWidget.trustedPreviewSubmit') }}

//- Отклонение заявки доверенного
BaseDialog(v-model='isDeclineOpen', :title='$t("ku.kuBranchDetailsWidget.declineDialogTitle")', size='sm')
  BaseForm(@submit='onDecline')
    BaseInput(v-model='declineReason', :label='$t("ku.kuBranchDetailsWidget.declineReasonLabel")', required)
    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant='secondary', type='button', @click='isDeclineOpen = false') {{ $t('common.action.back') }}
      BaseButton(variant='primary', type='submit', :loading='isSubmitting') {{ $t('ku.kuBranchDetailsWidget.requestsDecline') }}

//- Сбор паспорта доверенного лица перед подачей заявки (если паспорта ещё нет)
CollectPassportDialog(v-model='passportDialogOpen', @saved='onPassportSaved')
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useBranchStore } from 'src/entities/Branch/model';
import { useKuStore, KU_LIVE_TABLES } from 'src/entities/Ku/model';
import { useLiveReload } from 'src/shared/lib/realtime';
import type { IKuTrustRequest } from 'src/entities/Ku/model';
import type { IDocumentAggregate } from 'src/entities/Document/model';
import { useKuTrustedFlow } from 'src/features/Ku/TrustedFlow/model';
import { CollectPassportDialog, useRequirePassport } from 'src/features/User/CollectPassport';
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
import { t } from 'src/shared/i18n';

const props = defineProps<{ braname: string }>();

const skeletonColumns: TableSkeletonColumn[] = [
  { label: t('ku.kuBranchDetailsWidget.skeletonBranchColumn') },
  { label: t('ku.kuBranchDetailsWidget.skeletonChairmanColumn') },
  { label: t('ku.kuBranchDetailsWidget.skeletonTrustedColumn') },
];

const branchStore = useBranchStore();
const kuStore = useKuStore();
const system = useSystemStore();
const session = useSessionStore();
const flow = useKuTrustedFlow();
const { passportDialogOpen, requirePassport, onPassportSaved } = useRequirePassport();

const loading = ref(true);
const isDeclineOpen = ref(false);
const declineReason = ref('');
const declineTarget = ref<IKuTrustRequest | null>(null);
const isDocumentOpen = ref(false);
const documentTarget = ref<IDocumentAggregate | null>(null);
const isAuthorityOpen = ref(false);
const authorityTarget = ref<IDocumentAggregate | null>(null);
// предпросмотр пакета документов заявителя перед подписанием и подачей заявки
const trustedPreviewOpen = ref(false);
const trustedPrepared = ref<Awaited<ReturnType<typeof flow.prepareTrustedDocuments>> | null>(null);
const trustedInput = ref<{ braname: string; branchName: string; trustee: string } | null>(null);

const isSubmitting = computed(() => flow.isSubmitting.value);

// публичные данные участка (сертификаты с ФИО) — доступны любому пайщику
const branch = computed(
  () => branchStore.publicBranches.find((item: any) => item.braname === props.braname) as any | undefined,
);

const branchTitle = computed(
  () => branch.value?.short_name || branch.value?.full_name || t('ku.kuBranchDetailsWidget.defaultBranchTitle'),
);

// число пайщиков участка приходит в публичном payload ветки (participants_count)
const participantsCount = computed(() => branch.value?.participants_count ?? 0);

function fullName(person?: { last_name?: string; first_name?: string; middle_name?: string } | null): string {
  if (!person) return '—';
  return [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ') || '—';
}

const chairmanPerson = computed<Person>(() => ({
  fullName: fullName(branch.value?.trustee_certificate),
  role: t('ku.kuBranchDetailsWidget.chairmanRoleLabel'),
  accountName: branch.value?.trustee_certificate?.username,
}));

const trustedPersons = computed<Person[]>(() =>
  (branch.value?.trusted_certificates ?? []).map((person: any) => ({
    fullName: fullName(person),
    role: t('ku.kuBranchDetailsWidget.trustedRoleLabel'),
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

function openAuthority(request: IKuTrustRequest) {
  authorityTarget.value = (request as any).authority_document ?? null;
  isAuthorityOpen.value = true;
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


// доверенное лицо подписывает договор матответственности (327) и доверенность (330) —
// если паспорта в реестре ещё нет, сначала собираем его; затем генерируем документы с
// данными заявителя и показываем на прочтение; подпись и подача — после подтверждения
function onRequest() {
  return requirePassport(async () => {
    try {
      trustedInput.value = {
        braname: props.braname,
        branchName: branchTitle.value,
        // username председателя участка; ФИО фабрика резолвит сама, в meta уходит только username
        trustee: branch.value?.trustee_certificate?.username ?? '',
      };
      trustedPrepared.value = await flow.prepareTrustedDocuments(trustedInput.value);
      trustedPreviewOpen.value = true;
    } catch (e: unknown) {
      FailAlert(e);
    }
  });
}

async function confirmRequest() {
  if (!trustedPrepared.value || !trustedInput.value) return;
  trustedPreviewOpen.value = false;
  try {
    await flow.requestTrusted({ braname: trustedInput.value.braname }, trustedPrepared.value);
    SuccessAlert(t('ku.kuBranchDetailsWidget.successRequestSubmitted'));
    // Заявка отвечает после разбора своего блока — перечитываем сразу.
    await load(true);
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    trustedPrepared.value = null;
  }
}

// сгенерированные (ещё не подписанные) документы → агрегаты для BaseDocument (html есть, подписей нет)
const trustedPreviewDocs = computed(() => {
  const d = trustedPrepared.value;
  if (!d) return [];
  // неподписанный сгенерированный документ: реальных подписей и хэшей ещё нет —
  // оборачиваем в минимальный агрегат для предпросмотра (BaseDocument рендерит rawDocument)
  const wrap = (gen: object, title: string) => ({
    title,
    aggregate: { rawDocument: gen, document: { doc_hash: '', signatures: [] } } as unknown as IDocumentAggregate,
  });
  return [
    wrap(d.application, t('ku.kuBranchDetailsWidget.contractDialogTitle')),
    wrap(d.authority, t('ku.kuBranchDetailsWidget.authorityDialogTitle')),
  ];
});

async function onApprove(request: IKuTrustRequest) {
  try {
    await flow.approveTrusted(request);
    SuccessAlert(t('ku.kuBranchDetailsWidget.successTrustedApproved'));
    await load(true);
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
    SuccessAlert(t('ku.kuBranchDetailsWidget.successRequestDeclined'));
    await load(true);
  } catch (e: unknown) {
    FailAlert(e);
  }
}

async function load(silent = false) {
  try {
    await Promise.all([
      branchStore.loadPublicBranches({ coopname: system.info.coopname }),
      kuStore.loadTrustRequests({
        filter: { coopname: system.info.coopname, braname: props.braname },
        options: { page: 1, limit: 100, sortBy: '_created_at', sortOrder: 'DESC' },
      }),
    ]);
  } catch (e: unknown) {
    if (!silent) FailAlert(e);
  } finally {
    loading.value = false;
  }
}

// Участок и заявки на доверенность живут по ленте изменений — подача, одобрение
// и отказ видны сразу у заявителя и у председателя участка.
useLiveReload(KU_LIVE_TABLES, () => load(true));

watch(
  () => props.braname,
  () => {
    loading.value = true;
    load();
  },
);

onMounted(() => load());
</script>

<style scoped>
/* Карточка количества пайщиков участка */
.ku-members {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
  padding: var(--p-2, 8px);
}
.ku-members__icon {
  color: var(--p-primary);
  flex-shrink: 0;
}
.ku-members__count {
  font-size: var(--p-fs-display, 34px);
  font-weight: 600;
  line-height: 1.1;
  color: var(--p-ink);
}
.ku-members__hint {
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-2);
}

.ku-preview-doc__title {
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
  color: var(--p-ink-2);
  margin-bottom: var(--p-2, 8px);
}

/* Документы заявки — ссылки с иконкой в отдельной колонке (не кнопки) */
.ku-doc-links {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-1, 4px);
}
.ku-doc-link {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-primary);
  font-size: var(--p-fs-body-sm, 13px);
  cursor: pointer;
  transition: color var(--p-dur-fast, 120ms) var(--p-ease-standard, ease);
}
.ku-doc-link:hover {
  color: var(--p-primary-hover);
  text-decoration: underline;
}
</style>
