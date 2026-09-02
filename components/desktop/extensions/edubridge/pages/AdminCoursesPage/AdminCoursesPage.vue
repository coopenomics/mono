<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-courses:banner-dismissed")
    | Курсы кооператива. Добавьте курс, привяжите его к курсу на площадке и опубликуйте —
    | опубликованные курсы видны в каталоге всем посетителям.

  BaseTable(
    :columns="columns"
    :rows="items"
    row-key="id"
    :loading="loading && !items.length"
    hover
    min-width="1080px"
  )
    template(#cell-title="{ row }")
      .row.no-wrap.items-center
        .edu-courses__thumb.q-mr-md
          q-img(v-if="row.image_url" :src="row.image_url" :ratio="4 / 3" fit="cover" no-spinner)
          .edu-courses__thumb-empty(v-else)
            q-icon(name="image" size="18px")
        .col.ellipsis
          .text-weight-medium.ellipsis {{ row.title }}
          .t-muted.t-sm.ellipsis {{ row.subject }} · {{ row.grade }}
    template(#cell-carrier="{ row }")
      div {{ carrierLabel(row.carrier) }}
      .t-muted.t-sm.t-mono.ellipsis(v-if="row.external_ref" :title="row.external_ref") {{ row.external_ref }}
    template(#cell-fee_month="{ row }") {{ formatAsset2Digits(row.fee_month) }}
    template(#cell-fee_year="{ row }") {{ formatAsset2Digits(row.fee_year) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
    template(#cell-actions="{ row }")
      .row.no-wrap.justify-end.items-center.q-gutter-xs
        BaseButton(
          v-if="row.status !== Zeus.EduCourseStatus.PUBLISHED"
          variant="secondary" size="sm"
          :loading="busyId === row.id"
          @click="setStatus(row, Zeus.EduCourseStatus.PUBLISHED)"
        ) Опубликовать
        BaseButton(
          v-else
          variant="ghost" size="sm"
          :loading="busyId === row.id"
          @click="setStatus(row, Zeus.EduCourseStatus.DRAFT)"
        ) Снять
        BaseButton(variant="ghost" size="sm" icon-only aria-label="Изменить" @click="edit(row)")
          template(#icon-left)
            q-icon(name="edit" size="18px")

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
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseDialog, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { CARRIER_LABELS, COURSE_STATUS_LABELS, fetchCourses, setCourseStatus, type ICourse } from '../../entities/Course';
import { CourseForm } from '../../widgets/CourseForm';
import AddCourseHeaderButton from './AddCourseHeaderButton.vue';

/** Управление курсами — владелец и администратор (EduCourse:manage). */
const { registerAction } = useHeaderActions();

const items = ref<ICourse[]>([]);
const loading = ref(false);
const busyId = ref<string | null>(null);
const dialogOpen = ref(false);
const editing = ref<ICourse | null>(null);

// При `table-layout: fixed` колонка без ширины получает остаток: min-width
// таблицы держит ей ≥ 300px, иначе ячейки наезжали друг на друга.
const columns: BaseTableColumn<ICourse>[] = [
  { key: 'title', label: 'Курс', sortable: true },
  { key: 'carrier', label: 'Площадка', width: '200px' },
  { key: 'fee_month', label: 'В месяц', numeric: true, width: '130px', nowrap: true },
  { key: 'fee_year', label: 'В год', numeric: true, width: '130px', nowrap: true },
  { key: 'status', label: 'Состояние', width: '140px' },
  { key: 'actions', label: '', align: 'right', width: '180px' },
];

const statusOf = (s: string) => COURSE_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const carrierLabel = (c: string) => CARRIER_LABELS[c] ?? c;

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

<style scoped>
.edu-courses__thumb {
  flex: 0 0 64px;
  width: 64px;
  border-radius: var(--p-r-sm);
  overflow: hidden;
  background: var(--p-surface-2);
}
.edu-courses__thumb-empty {
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-ink-3);
}
</style>
