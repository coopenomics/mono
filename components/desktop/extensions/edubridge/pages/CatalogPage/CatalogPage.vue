<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:catalog:banner-dismissed")
    | Каталог курсов кооператива. Выберите предмет и класс, откройте карточку —
    | там расписание, преподаватель, размер членского взноса и учебная программа.

  FilterBar.q-mb-md(hide-search :filters="filters" :model-value="filterValues" @update:model-value="onFilters" @reset="onFilters({})")

  CardListSkeleton(v-if="loading && !items.length" :count="6")

  EmptyState(
    v-else-if="!items.length"
    title="Курсов пока нет"
    body="Как только кооператив опубликует курсы по выбранным предмету и классу, они появятся здесь."
  )
    template(#icon)
      q-icon(name="school" size="40px")

  .row.q-col-gutter-md(v-else)
    .col-12.col-sm-6.col-lg-4(v-for="course in items" :key="course.id")
      CourseCard(:course="course" @open="openCourse(course.id)")

  .row.justify-center.q-mt-lg(v-if="hasMore")
    BaseButton(variant="secondary" :loading="loading" @click="loadMore") Показать ещё
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { BaseButton, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { FilterBar, PageHint, type FilterDefinition, type FilterValues } from 'src/shared/ui/domain';
import { fetchCatalog, fetchCatalogSubjects, type ICatalogCourse, type ICatalogSubject } from '../../entities/Course';
import { CourseCard } from '../../widgets/CourseCard';

/**
 * Каталог курсов — витрина стола родителя, открытая посетителю до вступления.
 * Иерархия предмет → класс — двумя фильтрами поверх одного списка: бэкенд
 * отдаёт пары «предмет/класс», по которым есть опубликованные курсы.
 */
const PAGE_SIZE = 24;

const route = useRoute();
const router = useRouter();

const subjects = ref<ICatalogSubject[]>([]);
const subject = ref<string | null>(null);
const grade = ref<string | null>(null);
const items = ref<ICatalogCourse[]>([]);
const loading = ref(false);
const currentPage = ref(1);
const totalPages = ref(0);

const filters = computed<FilterDefinition[]>(() => [
  { key: 'subject', label: 'Предмет', type: 'select', options: subjects.value.map((s) => ({ value: s.subject, label: s.subject })) },
  {
    key: 'grade',
    label: 'Класс',
    type: 'select',
    options: (subjects.value.find((s) => s.subject === subject.value)?.grades ?? []).map((g) => ({ value: g, label: g })),
  },
]);
const filterValues = computed<FilterValues>(() => ({ subject: subject.value, grade: grade.value }));
const hasMore = computed(() => currentPage.value < totalPages.value);

async function load(page: number): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchCatalog({
      filter: { subject: subject.value ?? undefined, grade: grade.value ?? undefined },
      options: { page, limit: PAGE_SIZE, sortBy: 'sort_order', sortOrder: 'ASC' },
    });
    items.value = page === 1 ? result.items : [...items.value, ...result.items];
    currentPage.value = result.currentPage;
    totalPages.value = result.totalPages;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

// Класс имеет смысл только внутри предмета: сменили предмет — класс сбрасывается.
function onFilters(values: FilterValues): void {
  const nextSubject = (values.subject as string | null | undefined) ?? null;
  const nextGrade = (values.grade as string | null | undefined) ?? null;
  grade.value = nextSubject === subject.value ? nextGrade : null;
  subject.value = nextSubject;
  void load(1);
}

function loadMore(): void {
  void load(currentPage.value + 1);
}

function openCourse(id: string): void {
  void router.push({ name: 'edubridge-catalog-course', params: { coopname: route.params.coopname, id } });
}

onMounted(async () => {
  try {
    subjects.value = await fetchCatalogSubjects();
  } catch (e) {
    FailAlert(e);
  }
  void load(1);
});
</script>
