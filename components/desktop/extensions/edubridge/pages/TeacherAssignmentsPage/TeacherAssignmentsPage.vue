<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-assignments:banner-dismissed")
    | {{ $t('edubridge.teacherAssignmentsPage.hint.line1') }}
    | {{ $t('edubridge.teacherAssignmentsPage.hint.line2') }}

  CardListSkeleton(v-if="firstLoad" :count="2")
  template(v-else)
    //- Что ждёт подписи — сверху карточками: преподаватель должен сразу видеть, что ему подписать.
    template(v-if="awaiting.length")
      .t-eyebrow.q-mb-sm {{ $t('edubridge.teacherAssignmentsPage.awaitingTitle') }}
      BaseBanner.q-mb-md(v-if="!contractActive" variant="info")
        template(#icon)
          q-icon(name="schedule")
        | {{ $t('edubridge.teacherAssignmentsPage.contractPendingBanner') }}
      .row.q-col-gutter-md.q-mb-lg
        .col-12.col-md-6(v-for="a in awaiting" :key="asText(a.id)")
          BaseCard(variant="default" :title="a.course_title" :subtitle="$t('edubridge.teacherAssignmentsPage.annexSubtitle')")
            DataRow(:label="$t('edubridge.teacherAssignmentsPage.scheduleLabel')" :value="a.schedule || '______'")
            DataRow(:label="$t('edubridge.teacherAssignmentsPage.periodLabel')" :value="`${a.period_from} — ${a.period_to}`")
            DataRow(:label="$t('edubridge.teacherAssignmentsPage.expectedResultLabel')" :value="a.expected_result || '______'")
            BaseBanner.q-mt-sm(v-if="a.status === Zeus.EduAssignmentStatus.DECLINED" variant="neg")
              template(#icon)
                q-icon(name="block")
              | {{ a.decline_reason ? $t('edubridge.teacherAssignmentsPage.declinedBannerWithReason', { reason: a.decline_reason }) : $t('edubridge.teacherAssignmentsPage.declinedBanner') }}
            .row.justify-end.q-gutter-sm.q-mt-md
              BaseButton(variant="ghost" @click="openDetails(a)") {{ $t('edubridge.teacherAssignmentsPage.courseProgram') }}
              BaseButton(variant="primary" :disabled="!contractActive" @click="openAnnex(a)") {{ $t('edubridge.teacherAssignmentsPage.readAndSign') }}

    BaseTable(v-if="others.length" :columns="columns" :rows="others" row-key="id" min-width="960px" @row-click="openDetails")
      template(#cell-period="{ row }")
        div {{ $t('edubridge.teacherAssignmentsPage.periodFrom', { date: ruDate(row.period_from) }) }}
        div {{ $t('edubridge.teacherAssignmentsPage.periodTo', { date: ruDate(row.period_to) }) }}
      template(#cell-status="{ row }")
        BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
    EmptyState(v-if="!assignments.length" :title="$t('edubridge.teacherAssignmentsPage.emptyTitle')" :body="$t('edubridge.teacherAssignmentsPage.emptyBody')")
      template(#icon)
        q-icon(name="assignment" size="32px")

  //- Назначение целиком: условия приложения и программа курса — читать её на столе ученика незачем.
  DetailsDrawer(v-model="detailsOpen" :title="details?.course_title || $t('edubridge.teacherAssignmentsPage.detailsTitleFallback')" :width="640")
    template(v-if="details")
      BaseBadge.q-mb-md(:variant="statusOf(details.status).variant") {{ statusOf(details.status).label }}
      DataRow(:label="$t('edubridge.teacherAssignmentsPage.scheduleLabel')" :value="details.schedule || '______'")
      DataRow(:label="$t('edubridge.teacherAssignmentsPage.periodLabel')" :value="$t(`edubridge.teacherAssignmentsPage.periodRange`, { dateFrom: ruDate(details.period_from), dateTo: ruDate(details.period_to) })")
      DataRow(:label="$t('edubridge.teacherAssignmentsPage.expectedResultLabel')" :value="details.expected_result || '______'")
      .edu-assignment__section(v-if="details.course_description")
        .t-eyebrow.q-mb-sm {{ $t('edubridge.teacherAssignmentsPage.aboutTitle') }}
        .edu-assignment__text {{ details.course_description }}
      .edu-assignment__section
        .t-eyebrow.q-mb-sm {{ $t('edubridge.teacherAssignmentsPage.syllabusTitle') }}
        .edu-assignment__text(v-if="details.course_syllabus") {{ details.course_syllabus }}
        .t-muted.t-sm(v-else) {{ $t('edubridge.teacherAssignmentsPage.syllabusEmpty') }}
      .row.justify-end.q-mt-lg(v-if="awaitsTeacherSignature(details)")
        BaseButton(variant="primary" :disabled="!contractActive" @click="openAnnex(details)") {{ $t('edubridge.teacherAssignmentsPage.readAndSign') }}

  BaseDialog(v-model="annexOpen" size="lg" :title="signing ? $t(`edubridge.teacherAssignmentsPage.annexDialogTitle`, { courseTitle: signing.course_title }) : ''")
    EduGateDocumentStep(
      v-if="signing"
      :step-key="asText(signing.id)"
      :agree-label="$t('edubridge.teacherAssignmentsPage.annexAgreeLabel')"
      :action-label="$t('edubridge.teacherAssignmentsPage.annexSignAction')"
      :build="buildAnnex"
      :sign="signCurrent"
      @signed="onSigned"
    )
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import type { DigitalDocument } from 'src/shared/lib/document';
import { refreshMenuBadges } from 'src/shared/lib/menuBadges';
import { BaseBadge, BaseBanner, BaseButton, BaseCard, BaseDialog, BaseTable, CardListSkeleton, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import {
  ASSIGNMENT_STATUS_LABELS,
  awaitsTeacherSignature,
  buildAnnexDocument,
  fetchMyAssignments,
  fetchMyContract,
  signAnnex,
  type IAssignment,
  type IContract,
} from '../../entities/Teacher';
import { EduGateDocumentStep } from '../../features/OfferGate';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

/**
 * Назначения преподавателя. Назначение рождается черновиком, когда
 * администратор ставит преподавателя на курс, и действует после подписи
 * приложения к договору преподавателем и председателем. Неподписанные — сверху
 * карточками с документом к чтению и подписи; остальные — таблицей.
 */
// Договор нужен для подписи приложений (его номер уходит в документ); показывается он в профиле.
const contract = ref<IContract | null>(null);
const assignments = ref<IAssignment[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);

const annexOpen = ref(false);
const signing = ref<IAssignment | null>(null);
const annexDoc = ref<DigitalDocument | null>(null);

const columns: BaseTableColumn<IAssignment>[] = [
  { key: 'course_title', label: t('edubridge.teacherAssignmentsPage.columns.course') },
  { key: 'schedule', label: t('edubridge.teacherAssignmentsPage.scheduleLabel'), width: '180px' },
  { key: 'expected_result', label: t('edubridge.teacherAssignmentsPage.expectedResultLabel') },
  { key: 'period', label: t('edubridge.teacherAssignmentsPage.columns.period'), width: '160px' },
  { key: 'status', label: t('edubridge.teacherAssignmentsPage.columns.status'), width: '240px' },
];
const statusOf = (s: string) => ASSIGNMENT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
// Приложение подписывается только при действующем договоре.
const contractActive = computed(() => contract.value?.status === Zeus.EduContractStatus.ACTIVE);
const awaiting = computed(() => assignments.value.filter(awaitsTeacherSignature));
const others = computed(() => assignments.value.filter((a) => !awaitsTeacherSignature(a)));

async function load(): Promise<void> {
  loading.value = true;
  try {
    [contract.value, assignments.value] = await Promise.all([fetchMyContract(), fetchMyAssignments()]);
    // Открытое назначение — свежее: подпись председателя меняет его статус.
    if (details.value) details.value = assignments.value.find((x) => x.id === details.value?.id) ?? details.value;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

const detailsOpen = ref(false);
const details = ref<IAssignment | null>(null);
/** Дата периода по-русски: «2026-09-23» → «23.09.2026». */
const ruDate = (v: string) => String(v ?? '').slice(0, 10).split('-').reverse().join('.');

function openDetails(a: IAssignment): void {
  details.value = a;
  detailsOpen.value = true;
}

function openAnnex(a: IAssignment): void {
  detailsOpen.value = false;
  signing.value = a;
  annexDoc.value = null;
  annexOpen.value = true;
}

/** Экземпляр приложения для чтения — подписывается ровно он. */
async function buildAnnex(): Promise<string> {
  if (!signing.value || !contract.value) throw new Error(t('edubridge.error.assignmentOrContractMissing'));
  annexDoc.value = await buildAnnexDocument(signing.value, contract.value.contract_number);
  return annexDoc.value.data?.html ?? '';
}

async function signCurrent(): Promise<void> {
  if (!signing.value || !annexDoc.value) throw new Error(t('edubridge.error.annexNotBuilt'));
  const updated = await signAnnex(signing.value, annexDoc.value);
  assignments.value = assignments.value.map((x) => (x.id === updated.id ? updated : x));
}

function onSigned(): void {
  annexOpen.value = false;
  signing.value = null;
  SuccessAlert(t('edubridge.teacherAssignmentsPage.annexSignedSuccess'));
  void refreshMenuBadges(['edubridge-assignments']);
}

// Живое обновление: черновик появляется, когда администратор ставит на курс,
// решение председателя приходит со стола совета.
useLiveReload([EduLive.teacherContracts, EduLive.assignments], load);

onMounted(load);
</script>

<style scoped>
.edu-assignment__section {
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.edu-assignment__text {
  white-space: pre-wrap;
  font-size: var(--p-fs-body);
  line-height: 1.6;
}
</style>

