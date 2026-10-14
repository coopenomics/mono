<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-calendar:banner-dismissed")
    | {{ $t('edubridge.adminCalendarPage.hint') }}

  //- Отбор сверху: преподаватель и курс. Сводка по преподавателю — рядом, числами.
  BaseCard(variant="default")
    .edu-calendar__filters
      BaseSelect.edu-calendar__filter(v-model="teacherFilter" :label="$t('edubridge.adminCalendarPage.teacherFilter')" :options="teacherFilterOptions" clearable)
      BaseSelect.edu-calendar__filter(v-model="courseFilter" :label="$t('edubridge.adminCalendarPage.courseFilter')" :options="courseFilterOptions" clearable)
    .edu-calendar__summary(v-if="!firstLoad")
      span {{ $t('edubridge.adminCalendarPage.summary', { planned: summary.planned, held: summary.held, overdue: summary.overdue }) }}
    CardListSkeleton(v-if="firstLoad" :count="1")
    LessonCalendar(v-else :lessons="shown" :label-of="labelOf" @select="openDetails" @month-change="onMonthChange")

  DetailsDrawer(v-model="detailsOpen" :title="details ? $t('edubridge.lesson.numberShort', { number: details.lesson_number }) + ' · ' + details.course_title : ''" :width="520")
    template(v-if="details")
      LessonDetails(:lesson="details" :teacher-name="details.teacher_username ? fioCache.get(details.teacher_username) : null")
    template(v-if="details && canManageCourses && details.status === Zeus.EduLessonStatus.PLANNED" #footer)
      .row.justify-end.q-gutter-sm
        BaseButton(variant="danger" :loading="busy" @click="onCancel") {{ $t('edubridge.adminCalendarPage.cancelLesson') }}
        BaseButton(variant="primary" @click="moveOpen = true") {{ $t('edubridge.adminCalendarPage.moveLesson') }}

  PlanLessonDialog(v-model="planOpen" :group-options="groupOptions" :teacher-options="teacherOptionsFor(planCourseId)" @saved="onSaved")
  PlanLessonDialog(v-model="moveOpen" :lesson="details" :teacher-options="teacherOptionsFor(details ? String(details.course_id) : null)" @saved="onSaved")
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useHeaderActions } from 'src/shared/hooks';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asText } from 'src/shared/lib/utils';
import { useFioCache } from 'src/shared/lib/account/useFioCache';
import { BaseButton, BaseCard, BaseSelect, CardListSkeleton } from 'src/shared/ui/base';
import { DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { HeaderActionButton } from '../../shared/ui/HeaderActionButton';
import { useEduRights } from '../../shared/lib/rights';
import { cancelLesson, fetchLessonCalendar, type ICalendarLesson } from '../../entities/Lesson';
import { fetchAssignments, type IAssignment } from '../../entities/Teacher';
import { fetchCourses, type ICourse } from '../../entities/Course';
import { fetchCourseGroups, type IGroup } from '../../entities/Group';
import { LessonCalendar } from '../../widgets/LessonCalendar';
import { LessonDetails } from '../../widgets/LessonDetails';
import { PlanLessonDialog } from '../../features/PlanLesson';
import { t } from '../../i18n';

/**
 * Календарь школы: все занятия всех групп по месяцам. Администратор видит, кто
 * из преподавателей когда занят, что отчитано и что просрочено, назначает
 * занятия сверх расписания, переносит и отменяет запланированные.
 */
const { canManageCourses } = useEduRights();
const { fioCache, enrichFio } = useFioCache();

const lessons = ref<ICalendarLesson[]>([]);
const assignments = ref<IAssignment[]>([]);
const courses = ref<ICourse[]>([]);
const groups = ref<IGroup[]>([]);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);

const teacherFilter = ref<string | null>(null);
const courseFilter = ref<string | null>(null);
const teacherFilterOptions = computed(() =>
  [...new Set(assignments.value.map((a) => a.teacher_username))].map((u) => ({ value: u, label: fioCache.value.get(u) || u })),
);
const courseFilterOptions = computed(() => courses.value.map((c) => ({ value: asText(c.id), label: c.title })));

const shown = computed(() =>
  lessons.value.filter((l) => (!teacherFilter.value || l.teacher_username === teacherFilter.value) && (!courseFilter.value || asText(l.course_id) === courseFilter.value)),
);
const summary = computed(() => ({
  planned: shown.value.filter((l) => l.status === Zeus.EduLessonStatus.PLANNED && !l.overdue).length,
  held: shown.value.filter((l) => l.status === Zeus.EduLessonStatus.HELD).length,
  overdue: shown.value.filter((l) => l.overdue).length,
}));

/** Плитка календаря: группа и преподаватель — администратору важно, кто занят. */
const labelOf = (l: ICalendarLesson): string => {
  const teacher = l.teacher_username ? fioCache.value.get(l.teacher_username) || l.teacher_username : '';
  return [l.group_title || l.course_title, teacher].filter(Boolean).join(' · ');
};

/** Группы, в которые назначается занятие: идущие группы всех курсов. */
const groupOptions = computed(() =>
  groups.value
    .filter((g) => g.status === Zeus.EduGroupStatus.ACTIVE)
    .map((g) => ({ value: asText(g.id), label: `${courses.value.find((c) => asText(c.id) === asText(g.course_id))?.title ?? ''} · ${g.title}`, lessonMinutes: g.lesson_minutes })),
);
const planCourseId = ref<string | null>(null);
/** Допуски преподавателей к курсу — для окна назначения и переноса. */
function teacherOptionsFor(courseId: string | null | undefined): { value: string; label: string }[] {
  return assignments.value
    .filter((a) => a.status === Zeus.EduAssignmentStatus.ACTIVE && (!courseId || asText(a.course_id) === asText(courseId)))
    .map((a) => ({ value: asText(a.id), label: `${fioCache.value.get(a.teacher_username) || a.teacher_username} · ${a.course_title}` }));
}

const detailsOpen = ref(false);
const detailsId = ref<string | null>(null);
const details = computed(() => lessons.value.find((l) => asText(l.id) === detailsId.value) ?? null);
function openDetails(l: ICalendarLesson): void {
  detailsId.value = asText(l.id);
  detailsOpen.value = true;
}

const planOpen = ref(false);
const moveOpen = ref(false);

function replace(l: ICalendarLesson): void {
  const i = lessons.value.findIndex((x) => asText(x.id) === asText(l.id));
  if (i >= 0) lessons.value[i] = l;
  else lessons.value.push(l);
}
function onSaved(l: ICalendarLesson): void {
  replace(l);
  void load();
}

async function onCancel(): Promise<void> {
  if (!details.value) return;
  busy.value = true;
  try {
    replace(await cancelLesson(asText(details.value.id)));
    SuccessAlert(t('edubridge.adminCalendarPage.cancelled'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

/** Окно календаря — год вокруг открытого месяца; при смене месяца за его края список перечитывается. */
const windowStart = ref(new Date());
function onMonthChange(m: Date): void {
  if (Math.abs(m.getTime() - windowStart.value.getTime()) > 150 * 24 * 60 * 60 * 1000) {
    windowStart.value = m;
    void load();
  }
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const from = new Date(windowStart.value.getFullYear(), windowStart.value.getMonth() - 6, 1);
    const to = new Date(windowStart.value.getFullYear(), windowStart.value.getMonth() + 7, 1);
    const [l, a, c] = await Promise.all([fetchLessonCalendar({ from: from.toISOString(), to: to.toISOString() }), fetchAssignments(), fetchCourses({ options: { limit: 200 } } as never)]);
    lessons.value = l;
    assignments.value = a;
    courses.value = c.items;
    groups.value = (await Promise.all(c.items.map((course) => fetchCourseGroups(asText(course.id))))).flat();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

watch(
  () => [...new Set([...assignments.value.map((a) => a.teacher_username), ...lessons.value.map((l) => l.teacher_username).filter(Boolean) as string[]])],
  (list) => {
    if (list.length) void enrichFio(list);
  },
);

useLiveReload([EduLive.lessons, EduLive.groups, EduLive.assignments], load);

const { registerAction } = useHeaderActions();
onMounted(() => {
  if (canManageCourses.value) {
    registerAction({ id: 'edubridge:plan-lesson', component: HeaderActionButton, props: { label: t('edubridge.adminCalendarPage.planButton'), icon: 'add', onClick: () => (planOpen.value = true) } });
  }
  void load();
});
</script>

<style scoped>
.edu-calendar__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-3);
  margin-bottom: var(--p-2);
}
.edu-calendar__filter {
  flex: 1 1 240px;
  max-width: 360px;
}
.edu-calendar__summary {
  margin-bottom: var(--p-3);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
</style>
