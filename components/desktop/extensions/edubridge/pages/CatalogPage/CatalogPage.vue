<template lang="pug">
.q-pa-md
  PageHint(storage-key="edu:catalog:banner-dismissed")
    | Каталог курсов кооператива. Выберите предмет и класс, откройте карточку —
    | там расписание, преподаватель, размер членского взноса и учебная программа.

  .row.q-col-gutter-md.q-mb-md
    .col-12.col-md-4
      BaseSelect(
        v-model="subject"
        label="Предмет"
        :options="subjectOptions"
        clearable
        @update:model-value="onSubjectChange"
      )
    .col-12.col-md-4
      BaseSelect(
        v-model="grade"
        label="Класс"
        :options="gradeOptions"
        :disabled="!subject"
        clearable
        @update:model-value="reload"
      )

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
      BaseCard.edu-course-card(variant="default" @click="openCourse(course.id)")
        .edu-course-card__head
          .text-subtitle1.text-weight-medium {{ course.title }}
          BaseChip(variant="neutral" size="sm") {{ course.subject }} · {{ course.grade }}
        .t-muted.t-sm.q-mt-xs(v-if="course.schedule") {{ course.schedule }}
        .edu-course-card__fees.q-mt-md
          DataRow(label="Взнос в месяц" :value="formatAsset2Digits(course.fee_month)" align="vertical")
          DataRow(label="Взнос в год" :value="formatAsset2Digits(course.fee_year)" align="vertical")

  .row.justify-center.q-mt-lg(v-if="hasMore")
    BaseButton(variant="secondary" :loading="loading" @click="loadMore") Показать ещё
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCard, BaseChip, BaseSelect, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { DataRow, PageHint } from 'src/shared/ui/domain';
import { fetchCatalog, fetchCatalogSubjects, type ICatalogCourse, type ICatalogSubject } from '../../entities/Course';

/**
 * Каталог курсов — витрина, открытая посетителю до вступления.
 * Иерархия предмет → класс — двумя селектами поверх одного списка: бэкенд
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

const subjectOptions = computed(() => subjects.value.map((s) => ({ value: s.subject, label: s.subject })));
const gradeOptions = computed(() => {
  const found = subjects.value.find((s) => s.subject === subject.value);
  return (found?.grades ?? []).map((g) => ({ value: g, label: g }));
});
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

function reload(): void {
  void load(1);
}

function onSubjectChange(): void {
  grade.value = null;
  reload();
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
  reload();
});
</script>

<style scoped>
.edu-course-card {
  cursor: pointer;
  height: 100%;
}
.edu-course-card__head {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
.edu-course-card__fees {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--p-3);
}
</style>
