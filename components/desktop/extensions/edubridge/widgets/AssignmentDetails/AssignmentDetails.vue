<template lang="pug">
//- Назначение целиком — для правой панели: состояние, условия допуска и
//- программа курса. Одно и то же на «Назначениях» и в курсах профиля.
.edu-assignment-details
  BaseBadge.q-mb-md(:variant="status.variant") {{ status.label }}
  DataRow(:label="$t('edubridge.teacherAssignmentsPage.scheduleLabel')" :value="assignment.schedule || '______'")
  DataRow(:label="$t('edubridge.teacherAssignmentsPage.periodLabel')" :value="$t('edubridge.teacherAssignmentsPage.periodRange', { dateFrom: ruDate(assignment.period_from), dateTo: ruDate(assignment.period_to) })")
  DataRow(:label="$t('edubridge.teacherAssignmentsPage.expectedResultLabel')" :value="assignment.expected_result || '______'")
  .edu-assignment-details__section(v-if="assignment.course_description")
    .t-eyebrow.q-mb-sm {{ $t('edubridge.teacherAssignmentsPage.aboutTitle') }}
    .edu-assignment-details__text {{ assignment.course_description }}
  .edu-assignment-details__section
    .t-eyebrow.q-mb-sm {{ $t('edubridge.teacherAssignmentsPage.syllabusTitle') }}
    .edu-assignment-details__text(v-if="assignment.course_syllabus") {{ assignment.course_syllabus }}
    .t-muted.t-sm(v-else) {{ $t('edubridge.teacherAssignmentsPage.syllabusEmpty') }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseBadge } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { ASSIGNMENT_STATUS_LABELS, type IAssignment } from '../../entities/Teacher';

const props = defineProps<{ assignment: IAssignment }>();

const status = computed(() => ASSIGNMENT_STATUS_LABELS[props.assignment.status] ?? { label: props.assignment.status, variant: 'neutral' as const });
/** Дата периода по-русски: «2026-09-23» → «23.09.2026». */
const ruDate = (v: string) => String(v ?? '').slice(0, 10).split('-').reverse().join('.');
</script>

<style scoped>
.edu-assignment-details__section {
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.edu-assignment-details__text {
  white-space: pre-wrap;
  font-size: var(--p-fs-body);
  line-height: 1.6;
}
</style>
