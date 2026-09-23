<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:catalog:banner-dismissed")
    | Каталог курсов кооператива. Выберите раздел и уровень, откройте карточку —
    | там расписание, преподаватель, размер членского взноса и учебная программа.

  FilterBar.q-mb-md(hide-search :filters="filters" :model-value="filterValues" @update:model-value="onFilters" @reset="onFilters({})")

  CardListSkeleton(v-if="firstLoad" :count="6")

  EmptyState(
    v-else-if="!items.length"
    title="Курсов пока нет"
    body="Как только кооператив опубликует курсы в выбранном разделе и уровне, они появятся здесь."
  )
    template(#icon)
      q-icon(name="school" size="40px")

  .row.q-col-gutter-md(v-else)
    .col-12.col-sm-6.col-md-4(v-for="course in items" :key="asText(course.id)")
      CourseCard(:course="course" @open="openCourse(asText(course.id))")

  .row.justify-center.q-mt-lg(v-if="hasMore")
    BaseButton(variant="secondary" :loading="loading" @click="loadMore") Показать ещё
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { BaseButton, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { FilterBar, PageHint, type FilterDefinition, type FilterValues } from 'src/shared/ui/domain';
import { fetchCatalog, type ICatalogCourse } from '../../entities/Course';
import { fetchSections, type ISection } from '../../entities/Section';
import { CourseCard } from '../../widgets/CourseCard';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';

/**
 * Каталог курсов — витрина стола ученика, открытая посетителю до вступления.
 * Иерархия раздел → уровень — двумя фильтрами поверх одного списка: бэкенд
 * отдаёт пары «раздел/уровень», по которым есть опубликованные курсы.
 */
const PAGE_SIZE = 24;

const route = useRoute();
const router = useRouter();

// Разделы и уровни — из справочника, только те, где есть опубликованные курсы.
const sections = ref<ISection[]>([]);
const sectionId = ref<string | null>(null);
const levelId = ref<string | null>(null);
const items = ref<ICatalogCourse[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const currentPage = ref(1);
const totalPages = ref(0);

const filters = computed<FilterDefinition[]>(() => [
  { key: 'section_id', label: 'Раздел', type: 'select', options: sections.value.map((sec) => ({ value: String(sec.id), label: sec.title })) },
  {
    key: 'level_id',
    label: 'Уровень',
    type: 'select',
    options: (sections.value.find((sec) => sec.id === sectionId.value)?.levels ?? []).map((l) => ({ value: String(l.id), label: l.title })),
  },
]);
const filterValues = computed<FilterValues>(() => ({ section_id: sectionId.value, level_id: levelId.value }));
const hasMore = computed(() => currentPage.value < totalPages.value);

async function load(page: number): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchCatalog({
      filter: { section_id: sectionId.value ?? undefined, level_id: levelId.value ?? undefined },
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

// Уровень имеет смысл только внутри раздела: сменили раздел — уровень сбрасывается.
function onFilters(values: FilterValues): void {
  const nextSection = (values.section_id as string | null | undefined) ?? null;
  const nextLevel = (values.level_id as string | null | undefined) ?? null;
  levelId.value = nextSection === sectionId.value ? nextLevel : null;
  sectionId.value = nextSection;
  void load(1);
}

function loadMore(): void {
  void load(currentPage.value + 1);
}

function openCourse(id: string): void {
  void router.push({ name: 'edubridge-catalog-course', params: { coopname: route.params.coopname, id } });
}

const loadSections = () => fetchSections({ only_with_courses: true });

// Живое обновление: курсы и справочник меняет администратор — каталог
// перечитывает и список, и фильтры.
useLiveReload([EduLive.courses, EduLive.sections, EduLive.levels], async () => {
  sections.value = await loadSections();
  await load(1);
});

onMounted(async () => {
  try {
    sections.value = await loadSections();
  } catch (e) {
    FailAlert(e);
  }
  void load(1);
});
</script>
