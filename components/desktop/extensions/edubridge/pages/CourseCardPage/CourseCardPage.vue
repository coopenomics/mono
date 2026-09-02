<template lang="pug">
.q-pa-md
  CardListSkeleton(v-if="loading" :count="1")

  EmptyState(v-else-if="!course" title="Курс не найден" body="Возможно, курс снят с публикации.")
    template(#icon)
      q-icon(name="search_off" size="40px")

  template(v-else)
    .edu-course__hero.q-mb-md(v-if="course.image_url")
      q-img(:src="course.image_url" :ratio="21 / 9" fit="cover" no-spinner)
    .row.q-col-gutter-md
      .col-12.col-md-8
        BaseCard(variant="default")
          template(#head)
            div
              .row.q-gutter-xs.q-mb-sm
                BaseChip(variant="neutral" size="sm") {{ course.subject }}
                BaseChip(variant="neutral" size="sm") {{ course.grade }}
              .text-h5.text-weight-semibold {{ course.title }}
          .text-body1.edu-course__text(v-if="course.description") {{ course.description }}
          .t-muted(v-else) Описание курса появится позже.
          q-separator.q-my-md
          .text-subtitle2.q-mb-sm Учебная программа
          .text-body2.edu-course__text(v-if="course.syllabus") {{ course.syllabus }}
          .t-muted.t-sm(v-else) Программа будет опубликована позже.

      .col-12.col-md-4
        BaseCard(variant="default" title="Условия участия")
          DataRow(label="Расписание" :value="course.schedule || '______'")
          DataRow(:label="course.teacher_usernames.length > 1 ? 'Преподаватели' : 'Преподаватель'" :value="course.teacher_usernames.join(', ') || '______'" mono)
          DataRow(label="Членский взнос в месяц" :value="formatAsset2Digits(course.fee_month)" mono)
          DataRow(label="Членский взнос в год" :value="formatAsset2Digits(course.fee_year)" mono)
          .q-mt-md
            BaseButton(variant="primary" block @click="getAccess") Получить доступ
          .t-muted.t-sm.q-mt-sm(v-if="!session.isAuth")
            | Для записи на курс нужно вступить в кооператив — это займёт несколько минут.
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSessionStore } from 'src/entities/Session';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCard, BaseChip, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { fetchCatalogCourse, type ICatalogCourse } from '../../entities/Course';

/**
 * Страница курса для посетителя: обложка, описание, учебная программа,
 * условия участия. Тип направления не показывается — суть курса читается из
 * заголовка и описания. Название курса уходит в шапку стола.
 * «Получить доступ»: гость уходит во вступление, пайщик — к обучающимся.
 */
const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const desktopStore = useDesktopStore();

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
    if (course.value) desktopStore.setPageTitleOverride(course.value.title);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
});
onBeforeUnmount(() => desktopStore.clearPageTitleOverride());
</script>

<style scoped>
.edu-course__hero {
  border-radius: var(--p-r-lg);
  overflow: hidden;
  border: 1px solid var(--p-line);
  background: var(--p-surface-2);
}
.edu-course__text {
  white-space: pre-wrap;
}
</style>
