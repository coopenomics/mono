<template lang="pug">
.q-pa-md
  .row.q-col-gutter-md(v-if="loading")
    .col-12.col-md-8
      CardListSkeleton(:count="1")

  EmptyState(
    v-else-if="!course"
    title="Курс не найден"
    body="Возможно, курс снят с публикации."
  )
    template(#icon)
      q-icon(name="search_off" size="40px")

  .row.q-col-gutter-md(v-else)
    .col-12.col-md-8
      BaseCard(variant="default" :title="course.title")
        .row.q-col-gutter-sm.q-mb-sm
          .col-auto
            BaseChip(variant="neutral" size="sm") {{ course.subject }}
          .col-auto
            BaseChip(variant="neutral" size="sm") {{ course.grade }}
        .text-body2.edu-course__text(v-if="course.description") {{ course.description }}
        q-separator.q-my-md
        .text-subtitle2.q-mb-sm Учебная программа
        .text-body2.edu-course__text(v-if="course.syllabus") {{ course.syllabus }}
        .t-muted.t-sm(v-else) Программа будет опубликована позже.

    .col-12.col-md-4
      BaseCard(variant="default" title="Условия")
        DataRow(label="Расписание" :value="course.schedule || '—'")
        DataRow(:label="course.teacher_usernames.length > 1 ? 'Преподаватели' : 'Преподаватель'" :value="course.teacher_usernames.join(', ') || '—'" mono)
        DataRow(label="Членский взнос в месяц" :value="formatAsset2Digits(course.fee_month)")
        DataRow(label="Членский взнос в год" :value="formatAsset2Digits(course.fee_year)")
        .q-mt-md
          BaseButton(variant="primary" block @click="getAccess") Получить доступ
        .t-muted.t-sm.q-mt-sm(v-if="!session.isAuth")
          | Для записи на курс нужно вступить в кооператив — это займёт несколько минут.
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCard, BaseChip, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { fetchCatalogCourse, type ICatalogCourse } from '../../entities/Course';

/**
 * Карточка курса для посетителя: расписание, преподаватель, взнос, программа.
 * Тип направления не показывается — суть курса читается из заголовка и описания.
 * «Получить доступ»: гость уходит во вступление, пайщик — в стол «Моё обучение» (E6).
 */
const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const course = ref<ICatalogCourse | null>(null);
const loading = ref(true);

function getAccess(): void {
  const coopname = route.params.coopname;
  if (!session.isAuth) {
    void router.push({ name: 'signup', params: { coopname } });
    return;
  }
  void router.push({ name: 'edubridge-learners', params: { coopname }, query: { course: String(route.params.id) } });
}

onMounted(async () => {
  try {
    course.value = await fetchCatalogCourse(String(route.params.id));
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.edu-course__text {
  white-space: pre-wrap;
}
</style>
