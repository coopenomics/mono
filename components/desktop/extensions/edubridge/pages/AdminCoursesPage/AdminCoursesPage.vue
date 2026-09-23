<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-courses:banner-dismissed")
    | Курсы кооператива. Добавьте курс, привяжите его к курсу на площадке и опубликуйте —
    | опубликованные курсы видны в каталоге всем посетителям.

  CardListSkeleton(v-if="firstLoad" :count="3")
  .row.q-col-gutter-md(v-else-if="items.length")
    .col-12.col-sm-6.col-md-4.col-xl-3(v-for="course in items" :key="asText(course.id)")
      AdminCourseCard(:course="course" :teacher-names="teacherNames" @open="openCourse(asText(course.id))")

  EmptyState(v-if="!firstLoad && !items.length" title="Курсов пока нет" body="Добавьте первый курс кнопкой в правом верхнем углу.")
    template(#icon)
      q-icon(name="library_books" size="40px")

</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { useFioCache } from 'src/shared/lib/account/useFioCache';
import { CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { fetchCourses, type ICourse } from '../../entities/Course';
import { AdminCourseCard } from '../../widgets/AdminCourseCard';
import AddCourseHeaderButton from './AddCourseHeaderButton.vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';

/**
 * Реестр курсов — владелец и администратор (EduCourse:manage). Курсы карточками,
 * как в каталоге; карточка открывает страницу курса, где собрано управление.
 * Здесь остаётся только создание нового курса кнопкой в шапке.
 */
const route = useRoute();
const router = useRouter();
const { registerAction } = useHeaderActions();
const { fioCache, enrichFio } = useFioCache();
// Преподаватели на карточках — по ФИО: имена догружаем одним заходом на весь реестр.
const teacherNames = computed(() => Object.fromEntries(fioCache.value));

const items = ref<ICourse[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchCourses({ options: { page: 1, limit: 200, sortBy: 'sort_order', sortOrder: 'ASC' } });
    items.value = result.items;
    void enrichFio(result.items.flatMap((c) => c.teacher_usernames));
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

/** Новый курс заводится на полной странице — по разделам, как и правка. */
function add(): void {
  void router.push({ name: 'edubridge-admin-course-new', params: { coopname: route.params.coopname } });
}

function openCourse(id: string): void {
  void router.push({ name: 'edubridge-admin-course', params: { coopname: route.params.coopname, id } });
}

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.courses, EduLive.enrollments], load);

onMounted(() => {
  registerAction({ id: 'edubridge:add-course', component: AddCourseHeaderButton, props: { onClick: add } });
  void load();
});
</script>
