<template lang="pug">
.q-pa-md
  //- Разделы — вкладки под шапкой, уровни — ряд переключателей: каталог листают, а не настраивают.
  PageTabs(v-if="sections.length" hoist :tabs="sectionTabs" :active-key="sectionId ?? ALL" @select="(tab) => pickSection(tab.key)")

  .edu-catalog__levels.q-mb-md(v-if="levelChips.length > 1")
    button.chip.chip--lg.edu-catalog__level(
      v-for="l in levelChips"
      :key="l.key"
      type="button"
      :class="l.key === (levelId ?? ALL) ? 'chip--accent' : 'chip--neutral'"
      :aria-pressed="l.key === (levelId ?? ALL)"
      @click="pickLevel(l.key)"
    ) {{ l.label }}

  //- Каркас — в той же сетке и той же формы, что карточки курсов.
  .row.q-col-gutter-md(v-if="firstLoad" aria-busy="true")
    .col-12.col-sm-6.col-md-4(v-for="n in 6" :key="n")
      CourseCardSkeleton

  EmptyState(
    v-else-if="!items.length"
    :title="$t('edubridge.catalogPage.emptyTitle')"
    :body="$t('edubridge.catalogPage.emptyBody')"
  )
    template(#icon)
      q-icon(name="school" size="40px")

  .row.q-col-gutter-md(v-else)
    .col-12.col-sm-6.col-md-4(v-for="course in items" :key="asText(course.id)")
      CourseCard(:course="course" @open="openCourse(asText(course.id))")

  .row.justify-center.q-mt-lg(v-if="hasMore")
    BaseButton(variant="secondary" :loading="loading" @click="loadMore") {{ $t('edubridge.catalogPage.loadMore') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { BaseButton, EmptyState } from 'src/shared/ui/base';
import { CourseCardSkeleton } from '../../shared/ui/CourseCardSkeleton';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { fetchCatalog, type ICatalogCourse } from '../../entities/Course';
import { fetchSections, type ISection } from '../../entities/Section';
import { CourseCard } from '../../widgets/CourseCard';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

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
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const currentPage = ref(1);
const totalPages = ref(0);

/** Ключ «без отбора»: все разделы либо все уровни раздела. */
const ALL = 'all';
const sectionTabs = computed<PageTab[]>(() => [
  { key: ALL, label: t('edubridge.catalogPage.allSections') },
  ...sections.value.map((sec) => ({ key: String(sec.id), label: sec.title })),
]);
/**
 * Уровни видны всегда. Внутри раздела — его уровни. На вкладке «Все курсы» —
 * уровни всех разделов, одноимённые сведены в один: «1 класс» показывает курсы
 * первого класса по всем разделам, поэтому ключ там — название уровня.
 */
const levelChips = computed(() => {
  const all = { key: ALL, label: t('edubridge.catalogPage.allLevels') };
  if (sectionId.value) {
    const own = sections.value.find((sec) => String(sec.id) === sectionId.value)?.levels ?? [];
    return [all, ...own.map((l) => ({ key: String(l.id), label: l.title }))];
  }
  const titles = [...new Set(sections.value.flatMap((sec) => sec.levels ?? []).map((l) => l.title))];
  return [all, ...titles.map((title) => ({ key: title, label: title }))];
});
const hasMore = computed(() => currentPage.value < totalPages.value);

async function load(page: number): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchCatalog({
      // В разделе уровень отбирается по идентификатору, на вкладке «Все курсы» — по названию во всех разделах.
      filter: sectionId.value
        ? { section_id: sectionId.value, level_id: levelId.value ?? undefined }
        : { level_title: levelId.value ?? undefined },
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
function pickSection(key: string): void {
  sectionId.value = key === ALL ? null : key;
  levelId.value = null;
  void load(1);
}

function pickLevel(key: string): void {
  levelId.value = key === ALL ? null : key;
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

<style scoped>
.edu-catalog__levels {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2);
}
.edu-catalog__level {
  cursor: pointer;
  font-family: inherit;
}
</style>
