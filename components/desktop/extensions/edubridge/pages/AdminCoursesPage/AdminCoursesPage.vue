<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-courses:banner-dismissed")
    | Курсы кооператива. Добавьте курс, привяжите его к курсу на площадке и опубликуйте —
    | опубликованные курсы видны в каталоге всем посетителям.

  CardListSkeleton(v-if="firstLoad" :count="3")
  .row.q-col-gutter-md(v-else-if="items.length")
    .col-12.col-sm-6.col-md-4(v-for="course in items" :key="asText(course.id)")
      AdminCourseCard(:course="course" @open="openCourse(asText(course.id))")

  EmptyState(v-if="!firstLoad && !items.length" title="Курсов пока нет" body="Добавьте первый курс кнопкой в правом верхнем углу.")
    template(#icon)
      q-icon(name="library_books" size="40px")

  //- Новый курс заводится в правой панели — тем же порядком, что и правка курса.
  DetailsDrawer(v-model="dialogOpen" :title="editing ? 'Изменить курс' : 'Новый курс'" :width="720")
    CourseForm(ref="formRef" :course="editing" hide-footer @saved="onSaved" @busy="(v) => (saving = v)")
    template(#footer)
      .row.justify-end.q-gutter-sm
        BaseButton(variant="ghost" :disabled="saving" @click="dialogOpen = false") Отменить
        BaseButton(variant="primary" :loading="saving" @click="submitForm") {{ editing ? 'Сохранить' : 'Добавить курс' }}
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { BaseButton, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import { fetchCourses, type ICourse } from '../../entities/Course';
import { AdminCourseCard } from '../../widgets/AdminCourseCard';
import { CourseForm } from '../../widgets/CourseForm';
import AddCourseHeaderButton from './AddCourseHeaderButton.vue';

/**
 * Реестр курсов — владелец и администратор (EduCourse:manage). Курсы карточками,
 * как в каталоге; карточка открывает страницу курса, где собрано управление.
 * Здесь остаётся только создание нового курса кнопкой в шапке.
 */
const route = useRoute();
const router = useRouter();
const { registerAction } = useHeaderActions();

const items = ref<ICourse[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const dialogOpen = ref(false);
const saving = ref(false);
const editing = ref<ICourse | null>(null);
const formRef = ref<InstanceType<typeof CourseForm> | null>(null);

function submitForm(): void {
  void formRef.value?.submit();
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchCourses({ options: { page: 1, limit: 200, sortBy: 'sort_order', sortOrder: 'ASC' } });
    items.value = result.items;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function add(): void {
  editing.value = null;
  dialogOpen.value = true;
}

function openCourse(id: string): void {
  void router.push({ name: 'edubridge-admin-course', params: { coopname: route.params.coopname, id } });
}

function onSaved(course: ICourse): void {
  const i = items.value.findIndex((c) => c.id === course.id);
  if (i >= 0) items.value[i] = course;
  else items.value.push(course);
  dialogOpen.value = false;
}

onMounted(() => {
  registerAction({ id: 'edubridge:add-course', component: AddCourseHeaderButton, props: { onClick: add } });
  void load();
});
</script>
