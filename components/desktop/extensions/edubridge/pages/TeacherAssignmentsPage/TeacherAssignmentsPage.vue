<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-assignments:banner-dismissed")
    | {{ $t('edubridge.teacherAssignmentsPage.hint.line1') }}

  CardListSkeleton(v-if="firstLoad" :count="2")
  template(v-else)
    //- Допуск действует сразу, но отчитываться по занятиям можно только с действующим договором.
    BaseBanner.q-mb-md(v-if="assignments.length && !contractActive" variant="info")
      template(#icon)
        q-icon(name="schedule")
      | {{ $t('edubridge.teacherAssignmentsPage.contractPendingBanner') }}

    BaseTable(v-if="assignments.length" :columns="columns" :rows="assignments" row-key="id" min-width="960px" @row-click="openDetails")
      template(#cell-period="{ row }")
        div {{ $t('edubridge.teacherAssignmentsPage.periodFrom', { date: ruDate(row.period_from) }) }}
        div {{ $t('edubridge.teacherAssignmentsPage.periodTo', { date: ruDate(row.period_to) }) }}
      template(#cell-status="{ row }")
        BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
    EmptyState(v-else :title="$t('edubridge.teacherAssignmentsPage.emptyTitle')" :body="$t('edubridge.teacherAssignmentsPage.emptyBody')")
      template(#icon)
        q-icon(name="assignment" size="32px")

  //- Назначение целиком: условия допуска и программа курса — читать её на столе ученика незачем.
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
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, BaseBanner, BaseTable, CardListSkeleton, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import { ASSIGNMENT_STATUS_LABELS, fetchMyAssignments, fetchMyContract, type IAssignment, type IContract } from '../../entities/Teacher';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

/**
 * Назначения преподавателя — курсы, к которым он допущен. Допуск действует с
 * момента, когда администратор поставил преподавателя на курс: документа и
 * подписей он не требует, условия участия определяет договор.
 */
// Договор нужен для отчётов по занятиям; показывается он в профиле.
const contract = ref<IContract | null>(null);
const assignments = ref<IAssignment[]>([]);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);

const columns: BaseTableColumn<IAssignment>[] = [
  { key: 'course_title', label: t('edubridge.teacherAssignmentsPage.columns.course') },
  { key: 'schedule', label: t('edubridge.teacherAssignmentsPage.scheduleLabel'), width: '180px' },
  { key: 'expected_result', label: t('edubridge.teacherAssignmentsPage.expectedResultLabel') },
  { key: 'period', label: t('edubridge.teacherAssignmentsPage.columns.period'), width: '160px' },
  { key: 'status', label: t('edubridge.teacherAssignmentsPage.columns.status'), width: '160px' },
];
const statusOf = (s: string) => ASSIGNMENT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const contractActive = computed(() => contract.value?.status === Zeus.EduContractStatus.ACTIVE);

async function load(): Promise<void> {
  loading.value = true;
  try {
    [contract.value, assignments.value] = await Promise.all([fetchMyContract(), fetchMyAssignments()]);
    // Открытое назначение — свежее: администратор может снять допуск.
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

// Живое обновление: допуск появляется, когда администратор ставит на курс,
// и закрывается, когда снимает; договор — по подписи председателя.
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

