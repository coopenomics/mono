<template lang="pug">
.q-pa-md
  CardListSkeleton(v-if="firstLoad" :count="1")

  EmptyState(v-else-if="!course || !group" :title="$t('edubridge.adminGroupPage.notFoundTitle')" :body="$t('edubridge.adminGroupPage.notFoundBody')")
    template(#icon)
      q-icon(name="search_off" size="40px")

  template(v-else)
    //- Группа на белой подложке во всю ширину, как остальные страницы стола.
    BaseCard.q-mb-md(variant="default")
      .edu-group-page__crumb
        BackLink(:label="$t('edubridge.adminGroupPage.backToCourse', { courseTitle: course.title })" @click="goBack")
      .edu-group-page__title {{ group.title }}
      GroupDetails(:course="course" :group="group" :readonly="!canManageCourses" wide @changed="onChanged" @reload="load")

    //- Календарь занятий этой группы: что запланировано, что проведено, что просрочено.
    BaseCard(variant="default" :title="$t('edubridge.adminGroupPage.calendarTitle')")
      LessonCalendar(:lessons="lessons" :label-of="lessonLabel" @select="openLesson")

    DetailsDrawer(v-model="lessonOpen" :title="lesson ? $t('edubridge.lesson.numberShort', { number: lesson.lesson_number }) : ''" :width="520")
      LessonDetails(v-if="lesson" :lesson="lesson" :teacher-name="lesson.teacher_username ? fioCache.get(lesson.teacher_username) : null")
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { useFioCache } from 'src/shared/lib/account/useFioCache';
import { useLiveReload } from 'src/shared/lib/realtime';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { BaseCard, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { BackLink, DetailsDrawer } from 'src/shared/ui/domain';
import { fetchCourse, type ICourse } from '../../entities/Course';
import { fetchCourseGroups, type IGroup } from '../../entities/Group';
import { fetchLessonCalendar, type ICalendarLesson } from '../../entities/Lesson';
import { GroupDetails } from '../../widgets/GroupDetails';
import { LessonCalendar } from '../../widgets/LessonCalendar';
import { LessonDetails } from '../../widgets/LessonDetails';
import { EduLive } from '../../shared/lib/live';
import { useEduRights } from '../../shared/lib/rights';
import { t } from '../../i18n';

/**
 * Группа на отдельной странице. Сюда ведёт кнопка «Открыть страницу» в правой
 * панели реестра групп; содержимое то же, что в панели, но на всю ширину, со
 * своим адресом и с календарём занятий группы.
 */
const route = useRoute();
const router = useRouter();
const desktopStore = useDesktopStore();
const { canManageCourses } = useEduRights();
const { fioCache, enrichFio } = useFioCache();

const courseId = computed(() => String(route.params.id ?? ''));
const groupId = computed(() => String(route.params.groupId ?? ''));
const course = ref<ICourse | null>(null);
const group = ref<IGroup | null>(null);
const lessons = ref<ICalendarLesson[]>([]);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);

/** Отдельного запроса одной группы нет: берём её из групп курса. */
async function load(): Promise<void> {
  if (!courseId.value || !groupId.value) return;
  loading.value = true;
  try {
    const [c, groups, l] = await Promise.all([fetchCourse(courseId.value), fetchCourseGroups(courseId.value), fetchLessonCalendar({ group_id: groupId.value })]);
    course.value = c;
    group.value = groups.find((g) => asText(g.id) === groupId.value) ?? null;
    lessons.value = l;
    void enrichFio(l.map((x) => x.teacher_username).filter((u): u is string => Boolean(u)));
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

/** Группа изменена в виджете: подставляем её и перечитываем календарь — расписание его перестраивает. */
function onChanged(updated: IGroup): void {
  group.value = updated;
  void load();
}

const lessonOpen = ref(false);
const lessonId = ref<string | null>(null);
const lesson = computed(() => lessons.value.find((l) => asText(l.id) === lessonId.value) ?? null);
/** Подпись плитки занятия: преподаватель; без него — прямо сказано, что его нет. */
const lessonLabel = (l: ICalendarLesson): string => (l.teacher_username ? fioCache.value.get(l.teacher_username) || l.teacher_username : t('edubridge.adminGroupPage.lessonWithoutTeacher'));
function openLesson(l: ICalendarLesson): void {
  lessonId.value = asText(l.id);
  lessonOpen.value = true;
}

function goBack(): void {
  void router.push({ name: 'edubridge-admin-course', params: { coopname: route.params.coopname, id: courseId.value } });
}

// Группа меняется набором, занятиями, взносами и допусками преподавателей — страница обновляется сама.
useLiveReload([EduLive.groups, EduLive.enrollments, EduLive.lessons, EduLive.assignments], load);

// Переход с одной группы на другую не пересоздаёт страницу — перечитываем по новому адресу.
watch([courseId, groupId], () => load(), { immediate: true });

// Название группы — в заголовок шапки, пока открыта страница.
watch(
  () => group.value?.title || t('edubridge.adminGroupPage.pageTitle'),
  (title) => desktopStore.setPageTitleOverride(title),
  { immediate: true },
);
onUnmounted(() => desktopStore.clearPageTitleOverride());
</script>

<style scoped>
.edu-group-page__crumb {
  margin-bottom: var(--p-3);
  font-size: var(--p-fs-body-sm);
}
.edu-group-page__title {
  margin-bottom: var(--p-5);
  font-size: var(--p-fs-h2);
  line-height: var(--p-lh-h2);
  font-weight: 600;
  color: var(--p-ink);
}
</style>
