<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-courses:banner-dismissed")
    | Курсы кооператива. Добавьте курс, привяжите его к курсу на площадке и опубликуйте —
    | опубликованные курсы видны в каталоге всем посетителям.

  CardListSkeleton(v-if="loading && !items.length" :count="3")
  .row.q-col-gutter-md(v-else-if="items.length")
    .col-12.col-sm-6.col-lg-4(v-for="course in items" :key="course.id")
      AdminCourseCard(
        :course="course"
        :busy="busyId === course.id"
        @edit="edit(course)"
        @publish="setStatus(course, Zeus.EduCourseStatus.PUBLISHED)"
        @unpublish="setStatus(course, Zeus.EduCourseStatus.DRAFT)"
      )

  EmptyState(v-if="!loading && !items.length" title="Курсов пока нет" body="Добавьте первый курс кнопкой в правом верхнем углу.")
    template(#icon)
      q-icon(name="library_books" size="40px")

  BaseDialog(v-model="dialogOpen" :title="editing ? 'Изменить курс' : 'Новый курс'" size="lg")
    CourseForm(:course="editing" @saved="onSaved" @cancel="dialogOpen = false")
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { BaseDialog, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { fetchCourses, setCourseStatus, type ICourse } from '../../entities/Course';
import { AdminCourseCard } from '../../widgets/AdminCourseCard';
import { CourseForm } from '../../widgets/CourseForm';
import AddCourseHeaderButton from './AddCourseHeaderButton.vue';

/** Управление курсами — владелец и администратор (EduCourse:manage). Курсы — карточками, как в каталоге. */
const { registerAction } = useHeaderActions();

const items = ref<ICourse[]>([]);
const loading = ref(false);
const busyId = ref<string | null>(null);
const dialogOpen = ref(false);
const editing = ref<ICourse | null>(null);

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

function edit(course: ICourse): void {
  editing.value = course;
  dialogOpen.value = true;
}

function onSaved(course: ICourse): void {
  const i = items.value.findIndex((c) => c.id === course.id);
  if (i >= 0) items.value[i] = course;
  else items.value.push(course);
  dialogOpen.value = false;
}

async function setStatus(course: ICourse, status: ICourse['status']): Promise<void> {
  busyId.value = course.id;
  try {
    const updated = await setCourseStatus({ id: course.id, status });
    onSaved(updated);
    SuccessAlert(status === Zeus.EduCourseStatus.PUBLISHED ? 'Курс опубликован' : 'Курс снят с публикации');
  } catch (e) {
    FailAlert(e);
  } finally {
    busyId.value = null;
  }
}

onMounted(() => {
  registerAction({ id: 'edubridge:add-course', component: AddCourseHeaderButton, props: { onClick: add } });
  void load();
});
</script>
