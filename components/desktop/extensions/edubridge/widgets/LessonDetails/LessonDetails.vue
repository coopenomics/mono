<template lang="pug">
//- Занятие целиком: состояние, место в программе, время, преподаватель,
//- материалы. Действия над занятием даёт родитель слотом.
div
  BaseBadge.q-mb-md(:variant="state.variant") {{ state.label }}
  DataRow(:label="$t('edubridge.lessonDetails.course')" :value="lesson.course_title")
  DataRow(v-if="lesson.group_title" :label="$t('edubridge.lessonDetails.group')" :value="lesson.group_title")
  DataRow(:label="$t('edubridge.lessonDetails.number')" :value="String(lesson.lesson_number)")
  DataRow(:label="$t('edubridge.lessonDetails.moment')" :value="formatLessonMoment(lesson.held_at)")
  DataRow(:label="$t('edubridge.lessonDetails.duration')" :value="$t('edubridge.teacherLessonsPage.durationMinutes', { minutes: lesson.duration_minutes })")
  //- Кратность программе: единица — занятие курса; двухчасовое занятие при часовом занятии курса занимает два.
  DataRow(:label="$t('edubridge.lessonDetails.units')" :value="$t('edubridge.lessonDetails.unitsValue', { units: lesson.units, minutes: lesson.lesson_minutes }, Number(lesson.units))")
  DataRow(:label="$t('edubridge.lessonDetails.teacher')" :value="teacherName || lesson.teacher_username || $t('edubridge.lessonDetails.teacherNone')")
  DataRow(v-if="lesson.topic" :label="$t('edubridge.lessonDetails.topic')" :value="lesson.topic")
  //- Запланированное занятие: до какого момента принимается отчёт.
  DataRow(v-if="lesson.status === Zeus.EduLessonStatus.PLANNED" :label="$t('edubridge.lessonDetails.reportUntil')" :value="formatLessonMoment(lesson.report_until)")
  template(v-if="lesson.status === Zeus.EduLessonStatus.HELD")
    DataRow(v-if="lesson.reported_at" :label="$t('edubridge.lessonDetails.reportedAt')" :value="formatLessonMoment(lesson.reported_at)")
    DataRow(v-if="lesson.learners_count" :label="$t('edubridge.lessonDetails.learners')" :value="String(lesson.learners_count)")
    .t-muted.t-sm.q-mt-sm {{ $t('edubridge.lessonDetails.materials') }}
    .edu-lesson-details__files(v-if="lesson.materials.length")
      a.edu-lesson-details__link(v-for="link in lesson.materials" :key="link" :href="link" target="_blank" rel="noopener")
        q-icon(name="link" size="14px")
        span {{ link }}
    .t-muted.t-sm(v-else) ______
  slot
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { BaseBadge } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { formatLessonMoment, lessonStateOf, type ICalendarLesson } from '../../entities/Lesson';

const props = defineProps<{
  lesson: ICalendarLesson;
  /** ФИО преподавателя; без него показано учётное имя. */
  teacherName?: string | null;
}>();

const state = computed(() => lessonStateOf(props.lesson));
</script>

<style scoped>
.edu-lesson-details__files {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
.edu-lesson-details__link {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  font-size: var(--p-fs-body-sm);
  color: var(--p-primary);
  text-decoration: none;
  overflow-wrap: anywhere;
}
.edu-lesson-details__link:hover {
  text-decoration: underline;
}
</style>
