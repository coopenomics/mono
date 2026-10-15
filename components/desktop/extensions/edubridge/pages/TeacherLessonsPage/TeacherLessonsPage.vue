<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-lessons:banner-dismissed")
    | {{ $t('edubridge.teacherLessonsPage.hintCalendar') }}

  //- Календарь преподавателя: его занятия по месяцам; плитка открывает занятие, у прошедшего — отчёт.
  //- Отчёты, документы на подпись и журнал — на странице «Отчёты».
  BaseCard(variant="default" :title="$t('edubridge.teacherLessonsPage.calendarTitle')")
    CardListSkeleton(v-if="firstLoad" :count="1")
    LessonCalendar(v-else :lessons="lessons" :label-of="(l) => l.group_title || l.course_title" @select="openLesson")

  //- Занятие из календаря: запланированное — с кнопкой отчёта, проведённое без взноса — с материалами.
  DetailsDrawer(v-model="lessonOpen" :title="lessonInView ? $t('edubridge.lesson.numberShort', { number: lessonInView.lesson_number }) + ' · ' + lessonInView.course_title : ''" :width="520")
    template(v-if="lessonInView")
      LessonDetails(:lesson="lessonInView" :teacher-name="lessonInView.teacher_username ? fioCache.get(lessonInView.teacher_username) : null")
      //- Занятие прошло, а обучающихся с оплаченным доступом на его дату не было: отчёта не ждём.
      BaseBanner.q-mt-md(v-if="hasEnded(lessonInView) && !isReportable(lessonInView)" variant="info")
        template(#icon)
          q-icon(name="group_off")
        | {{ $t('edubridge.teacherLessonsPage.noLearnersNote') }}
      BaseBanner.q-mt-md(v-else-if="lessonInView.status === Zeus.EduLessonStatus.PLANNED && !isReportable(lessonInView)" variant="info")
        template(#icon)
          q-icon(name="schedule")
        | {{ $t('edubridge.teacherLessonsPage.reportAfterLesson', { moment: formatLessonMoment(lessonInView.ends_at) }) }}
    template(v-if="lessonInView && isReportable(lessonInView)" #footer)
      .row.justify-end
        BaseButton(variant="primary" @click="openReport(lessonInView)") {{ $t('edubridge.teacherLessonsPage.reportButton') }}

  LessonReportDialog(:lesson="reportTarget" @close="reportTarget = null" @busy="reporting = $event" @done="load")
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { asText } from 'src/shared/lib/utils';
import { useFioCache } from 'src/shared/lib/account/useFioCache';
import { BaseBanner, BaseButton, BaseCard, CardListSkeleton } from 'src/shared/ui/base';
import { DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import type { ILesson } from '../../entities/Teacher';
import { formatLessonMoment, hasEnded, isReportable } from '../../entities/Lesson';
import { useTeacherLessons } from '../../features/TeacherLessons';
import { LessonCalendar } from '../../widgets/LessonCalendar';
import { LessonDetails } from '../../widgets/LessonDetails';
import { LessonReportDialog } from '../../widgets/LessonReportDialog';

/**
 * Календарь преподавателя. Занятия в календаре ставит администратор;
 * преподаватель открывает занятие и после его конца отчитывается темой и
 * материалами. Список занятий без отчёта, подпись документов и журнал взносов
 * — на странице «Отчёты».
 */
// realtime: живое обновление занятий и взносов — в useTeacherLessons
const { lessons, firstLoad, reporting, load } = useTeacherLessons();

/** Занятие из календаря — в своей панели. */
const lessonOpen = ref(false);
const lessonInViewId = ref<string | null>(null);
const lessonInView = computed(() => lessons.value.find((l) => asText(l.id) === lessonInViewId.value) ?? null);
/** Преподаватель занятия показан по имени, а не по учётной записи; имена дочитываются по мере появления занятий. */
const { fioCache, enrichFio } = useFioCache();
watch(
  () => lessons.value.map((l) => l.teacher_username).filter((u): u is string => Boolean(u)),
  (usernames) => {
    if (usernames.length) void enrichFio([...new Set(usernames)]);
  },
  { immediate: true },
);
function openLesson(l: ILesson): void {
  lessonInViewId.value = asText(l.id);
  lessonOpen.value = true;
}

const reportTarget = ref<ILesson | null>(null);
function openReport(lesson: ILesson): void {
  lessonOpen.value = false;
  reportTarget.value = lesson;
}
</script>
