<template lang="pug">
.q-pa-md
  CardListSkeleton(v-if="loading" :count="1")

  EmptyState(v-else-if="!course" title="Курс не найден" body="Возможно, курс снят с публикации.")
    template(#icon)
      q-icon(name="search_off" size="40px")

  template(v-else)
    .edu-course__head
      .t-eyebrow {{ course.subject }} · {{ course.grade }}
      .edu-course__title {{ course.title }}
      .edu-course__facts(v-if="course.schedule || course.starts_at")
        span.edu-course__fact(v-if="course.starts_at")
          q-icon(name="event" size="16px")
          | Занятия с {{ formatDate(course.starts_at) }}
        span.edu-course__fact(v-if="course.schedule")
          q-icon(name="schedule" size="16px")
          | {{ course.schedule }}

    .row.q-col-gutter-md
      .col-12.col-md-8
        BaseCard.edu-course__about(variant="default")
          q-img.edu-course__cover(v-if="course.image_url" :src="course.image_url" :ratio="21 / 9" fit="cover" no-spinner)
          .edu-course__about-body
            section
              .edu-course__section-title О курсе
              .edu-course__text(v-if="course.description") {{ course.description }}
              .t-muted.t-sm(v-else) Описание курса появится позже.
            section
              .edu-course__section-title Учебная программа
              .edu-course__text(v-if="course.syllabus") {{ course.syllabus }}
              .t-muted.t-sm(v-else) Программа будет опубликована позже.

      .col-12.col-md-4
        //- Условия и кнопка записи держатся на виду, пока читают описание.
        BaseCard.edu-course__terms(variant="default")
          //- Обе полные суммы рядом: скидка видна как разница в рублях, а не
          //- как цена «от …», которую участник ни разу не вносит.
          .t-meta Членский взнос
          .edu-course__option
            .edu-course__option-name Помесячно
            FeeAmount(:value="course.fee_month" size="lg" per="в месяц")
            .t-sm.t-muted(v-if="course.fee_course_base") всего за {{ months }} — {{ formatAsset2Digits(course.fee_course_base) }}
            .t-sm.t-muted(v-else-if="months") курс длится {{ months }}
          template(v-if="course.fee_course")
            .edu-course__or или
            .edu-course__option
              .edu-course__option-name За весь курс разом
              FeeAmount(:value="course.fee_course" size="lg")
              .t-sm.t-muted за {{ months }} · меньше на {{ formatAsset2Digits(course.course_discount_amount) }}
          BaseButton.q-mt-md(variant="primary" block @click="getAccess") Получить доступ
          .t-muted.t-sm.q-mt-sm(v-if="!session.isAuth")
            | Для записи на курс нужно вступить в кооператив — это займёт несколько минут.
          .edu-course__terms-rows
            DataRow(v-if="course.lessons_per_month" label="Занятий в месяц" :value="String(course.lessons_per_month)" align="spread")
            DataRow(v-if="course.lesson_minutes" label="Занятие" :value="`${course.lesson_minutes} мин`" align="spread")
            DataRow(v-if="course.lessons_total" label="Занятий в программе" :value="String(course.lessons_total)" align="spread")
          template(v-if="course.teacher_usernames.length")
            .edu-course__section-title.q-mt-md {{ course.teacher_usernames.length > 1 ? 'Преподаватели' : 'Преподаватель' }}
            .edu-course__teachers
              .edu-course__teacher(v-for="username in course.teacher_usernames" :key="username") {{ fioCache.get(username) || username }}

    SubscribeDialog(
      v-model="subscribeOpen"
      :learners="learners"
      :courses="course ? [course] : []"
      :locked-course-id="asText(course?.id) || null"
      @learner-added="onLearnerAdded"
      @subscribed="onSubscribed"
    )
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { asText } from 'src/shared/lib/utils';
import { FailAlert } from 'src/shared/api';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSessionStore } from 'src/entities/Session';
import { useFioCache } from 'src/shared/lib/account/useFioCache';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseCard, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { fetchCatalogCourse, type ICatalogCourse } from '../../entities/Course';
import { fetchMyLearners, type ILearner } from '../../entities/Learner';
import { SubscribeDialog } from '../../features/Subscribe';
import { courseMonthsLabel } from '../../shared/lib/courseMonths';
import { FeeAmount } from '../../shared/ui/FeeAmount';

/**
 * Страница курса для посетителя: обложка, описание, учебная программа,
 * условия участия. Тип направления не показывается — суть курса читается из
 * заголовка и описания. Название курса уходит в шапку стола.
 * «Получить доступ»: гость уходит во вступление, пайщик оформляет подписку
 * здесь же — обучающегося можно завести прямо в диалоге.
 */
const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const desktopStore = useDesktopStore();

const course = ref<ICatalogCourse | null>(null);
const loading = ref(true);
const subscribeOpen = ref(false);
const learners = ref<ILearner[]>([]);
const { fioCache, enrichFio } = useFioCache();
const months = computed(() => courseMonthsLabel(course.value?.course_months));
const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('ru-RU') : '______');

// Преподаватель посетителю — по имени: учётное имя ничего ему не говорит.
watch(
  () => course.value?.teacher_usernames,
  (list) => {
    if (list?.length) void enrichFio(list);
  },
);

async function getAccess(): Promise<void> {
  if (!session.isAuth) {
    void router.push({ name: 'signup', params: { coopname: route.params.coopname } });
    return;
  }
  // Оферта родителя-слушателя не подписана — бэкенд откажет в подписке, поэтому
  // сначала гейт подключения (право `Onboarding:learner` живёт ровно до подписи).
  if (desktopStore.hasGrant('edubridge-member', 'Onboarding:learner')) {
    void router.push({ name: 'edubridge-member-onboarding', params: { coopname: route.params.coopname } });
    return;
  }
  try {
    learners.value = await fetchMyLearners();
  } catch (e) {
    FailAlert(e);
    return;
  }
  subscribeOpen.value = true;
}

function onLearnerAdded(l: ILearner): void {
  const i = learners.value.findIndex((x) => x.id === l.id);
  if (i >= 0) learners.value[i] = l;
  else learners.value.push(l);
}

/** Подписка оформлена здесь же — дальше человеку нужны сроки и состояние доступа. */
function onSubscribed(): void {
  subscribeOpen.value = false;
  void router.push({ name: 'edubridge-subscriptions', params: { coopname: route.params.coopname } });
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
.edu-course__head {
  margin-bottom: var(--p-4);
}
.edu-course__title {
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: var(--p-ink);
}
.edu-course__facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2) var(--p-4);
  margin-top: var(--p-2);
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
}
.edu-course__fact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.edu-course__fact .q-icon {
  color: var(--p-ink-3);
}
/* Обложка идёт от края до края карточки, текст под ней — со своими полями. */
.edu-course__about {
  overflow: hidden;
}
.edu-course__about :deep(.base-card__body) {
  padding: 0;
}
.edu-course__cover {
  border-bottom: 1px solid var(--p-line);
  background: var(--p-surface-2);
}
.edu-course__about-body {
  display: flex;
  flex-direction: column;
  gap: var(--p-6);
  padding: var(--p-5) var(--p-6) var(--p-6);
}
.edu-course__section-title {
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  color: var(--p-ink);
  margin-bottom: var(--p-2);
}
.edu-course__text {
  white-space: pre-wrap;
  max-width: 68ch;
  font-size: var(--p-fs-body, 14px);
  line-height: 1.6;
}
.edu-course__terms {
  position: sticky;
  top: var(--p-4);
}
.edu-course__option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  margin-top: var(--p-2);
}
.edu-course__option-name {
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
  color: var(--p-ink);
}
/* «или» между двумя способами — тонкая линия с подписью посередине. */
.edu-course__or {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  margin: var(--p-3) 0 var(--p-1);
  color: var(--p-ink-3);
  font-size: var(--p-fs-meta, 12px);
}
.edu-course__or::before,
.edu-course__or::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--p-line);
}
.edu-course__terms-rows {
  margin-top: var(--p-4);
  padding-top: var(--p-2);
  border-top: 1px solid var(--p-line);
}
.edu-course__teachers {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--p-fs-body, 14px);
}
</style>
