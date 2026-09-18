<template lang="pug">
.q-pa-md
  BaseButton.edu-course-admin__back(variant="ghost" size="sm" @click="goBack")
    template(#icon-left)
      q-icon(name="arrow_back" size="16px")
    | К реестру курсов

  CardListSkeleton(v-if="firstLoad" :count="1")

  EmptyState(v-else-if="!course" title="Курс не найден" body="Возможно, курс удалён из реестра.")
    template(#icon)
      q-icon(name="search_off" size="40px")

  .row.q-col-gutter-md.q-mt-none(v-else)
    .col-12.col-md-8
      BaseCard(variant="default")
        template(#head)
          .row.items-center.q-gutter-sm
            BaseBadge(:variant="status.variant") {{ status.label }}
            BaseChip(variant="neutral" size="sm") {{ course.subject }}
            BaseChip(variant="neutral" size="sm") {{ course.grade }}
        .edu-course-admin__cover.q-mb-md
          q-img(v-if="course.image_url" :src="course.image_url" :ratio="21 / 9" fit="cover" no-spinner)
          .edu-course-admin__placeholder(v-else)
            q-icon(name="image" size="40px")
        .text-body2.edu-course-admin__text(v-if="course.description") {{ course.description }}
        .t-muted.t-sm(v-else) Описание курса не заполнено — в каталоге его место будет пустым.
        q-separator.q-my-md
        .text-subtitle2.q-mb-sm Учебная программа
        .text-body2.edu-course-admin__text(v-if="course.syllabus") {{ course.syllabus }}
        .t-muted.t-sm(v-else) Программа не заполнена.

    .col-12.col-md-4
      BaseCard.edu-course-admin__side(variant="default" title="Управление")
        .column.q-gutter-sm
          BaseButton(variant="secondary" block @click="editOpen = true") Изменить курс
          BaseButton(v-if="published" variant="ghost" block :loading="busy" @click="setStatus(Zeus.EduCourseStatus.DRAFT)") Снять с публикации
          BaseButton(v-else variant="primary" block :loading="busy" @click="setStatus(Zeus.EduCourseStatus.PUBLISHED)") Опубликовать
        .t-muted.t-meta.q-mt-sm {{ published ? 'Курс виден в каталоге всем посетителям.' : 'Черновик виден только на этом столе.' }}

      BaseCard.q-mt-md(variant="default" title="Условия участия")
        DataRow(label="Членский взнос в месяц" :value="formatAsset2Digits(course.fee_month)" mono)
        DataRow(label="Членский взнос в год" :value="formatAsset2Digits(course.fee_year)" mono)
        DataRow(label="Расписание" :value="course.schedule || '______'")

      BaseCard.q-mt-md(variant="default" title="Выдача доступа")
        DataRow(label="Направление" :value="directionLabel")
        DataRow(label="Площадка" :value="carrierLabel")
        DataRow(v-if="course.external_ref" label="Курс на площадке" :value="course.external_ref" mono copyable)
        DataRow(v-if="course.external_title_seen" label="Название на площадке" :value="course.external_title_seen")

      BaseCard.q-mt-md(variant="default" title="Преподаватели")
        q-list(v-if="course.teacher_usernames.length" separator)
          q-item(v-for="username in course.teacher_usernames" :key="username")
            q-item-section
              IdentityCell(:account-name="username")
        .t-muted.t-sm(v-else) Преподаватели не назначены — назначения оформляются на странице «Преподаватели».

  BaseDialog(v-model="editOpen" title="Изменить курс" size="lg")
    CourseForm(:course="course" @saved="onSaved" @cancel="editOpen = false")
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, BaseChip, BaseDialog, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { DataRow, IdentityCell } from 'src/shared/ui/domain';
import { CARRIER_LABELS, COURSE_STATUS_LABELS, DIRECTION_LABELS, fetchCourse, setCourseStatus, type ICourse } from '../../entities/Course';
import { CourseForm } from '../../widgets/CourseForm';

/**
 * Курс глазами администратора на отдельной странице: открывается кликом по
 * карточке в реестре. Всё управление курсом собрано здесь — под карточками
 * реестра кнопок нет, там только витрина.
 */
const route = useRoute();
const router = useRouter();
const desktopStore = useDesktopStore();

const course = ref<ICourse | null>(null);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);
const editOpen = ref(false);

const status = computed(() => COURSE_STATUS_LABELS[course.value?.status ?? ''] ?? { label: course.value?.status ?? '', variant: 'neutral' as const });
const published = computed(() => course.value?.status === Zeus.EduCourseStatus.PUBLISHED);
const carrierLabel = computed(() => CARRIER_LABELS[course.value?.carrier ?? ''] ?? course.value?.carrier ?? '______');
const directionLabel = computed(() => DIRECTION_LABELS[course.value?.direction ?? ''] ?? course.value?.direction ?? '______');

function goBack(): void {
  void router.push({ name: 'edubridge-admin-courses', params: { coopname: route.params.coopname } });
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    course.value = await fetchCourse(String(route.params.id));
    if (course.value) desktopStore.setPageTitleOverride(course.value.title);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function onSaved(updated: ICourse): void {
  course.value = updated;
  desktopStore.setPageTitleOverride(updated.title);
  editOpen.value = false;
}

async function setStatus(next: ICourse['status']): Promise<void> {
  if (!course.value) return;
  busy.value = true;
  try {
    course.value = await setCourseStatus({ id: course.value.id, status: next });
    SuccessAlert(next === Zeus.EduCourseStatus.PUBLISHED ? 'Курс опубликован' : 'Курс снят с публикации');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
onBeforeUnmount(() => desktopStore.clearPageTitleOverride());
</script>

<style scoped>
.edu-course-admin__back {
  align-self: flex-start;
  margin-bottom: var(--p-3);
}
.edu-course-admin__cover {
  border-radius: var(--p-r-lg);
  overflow: hidden;
  border: 1px solid var(--p-line);
  background: var(--p-surface-2);
}
.edu-course-admin__placeholder {
  aspect-ratio: 21 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-ink-3);
}
.edu-course-admin__text {
  white-space: pre-wrap;
}
</style>
