<template lang="pug">
.q-pa-md
  CardListSkeleton(v-if="loading" :count="1")

  EmptyState(v-else-if="!course" title="Курс не найден" body="Возможно, курс снят с публикации.")
    template(#icon)
      q-icon(name="search_off" size="40px")

  template(v-else)
    CourseHero(:title="course.title" :section="course.section_title" :level="course.level_title" :image-url="course.image_url")
      template(#facts)
        span(v-if="course.schedule") {{ course.schedule }}
        span(v-if="course.starts_at") занятия с {{ formatDate(course.starts_at) }}
      template(#actions)
        BaseButton(variant="primary" @click="getAccess") Получить доступ
        .edu-course__guest(v-if="!session.isAuth") Для записи нужно вступить в кооператив
      //- Обе полные суммы рядом: скидка видна как разница в рублях, а не как
      //- цена «от …», которую участник ни разу не вносит.
      CourseHeroFigure(caption="взнос в месяц")
        FeeAmount(:value="course.fee_month" size="lg")
      CourseHeroFigure(v-if="course.fee_course" caption="за весь курс разом")
        FeeAmount(:value="course.fee_course" size="lg")
      CourseHeroFigure(:value="course.lessons_per_month" :caption="`${pluralize(Number(course.lessons_per_month), LESSON_FORMS)} в месяц по ${course.lesson_minutes} мин`")
      CourseHeroFigure(:value="course.lessons_total" :caption="`${pluralize(Number(course.lessons_total), LESSON_FORMS)} в программе`")

    .row.q-col-gutter-md
      .col-12(:class="course.teacher_usernames.length ? 'col-md-8' : ''")
        BaseCard.edu-course__about(variant="default")
          section
            .edu-course__section-title О курсе
            .edu-course__text(v-if="course.description") {{ course.description }}
            .t-muted.t-sm(v-else) Описание курса появится позже.
          section
            .edu-course__section-title Учебная программа
            .edu-course__text(v-if="course.syllabus") {{ course.syllabus }}
            .t-muted.t-sm(v-else) Программа будет опубликована позже.

      .col-12.col-md-4(v-if="course.teacher_usernames.length")
        BaseCard(variant="default" :title="course.teacher_usernames.length > 1 ? 'Курс ведут' : 'Курс ведёт'")
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
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { asText, pluralize } from 'src/shared/lib/utils';
import { FailAlert } from 'src/shared/api';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSessionStore } from 'src/entities/Session';
import { useFioCache } from 'src/shared/lib/account/useFioCache';
import { BaseButton, BaseCard, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { fetchCatalogCourse, type ICatalogCourse } from '../../entities/Course';
import { fetchMyLearners, type ILearner } from '../../entities/Learner';
import { SubscribeDialog } from '../../features/Subscribe';
import { LESSON_FORMS } from '../../shared/lib/courseMonths';
import { FeeAmount } from '../../shared/ui/FeeAmount';
import { CourseHero, CourseHeroFigure } from '../../widgets/CourseHero';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';

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

/** Курс из каталога; живое перечитывание — без скелетона, курс остаётся на экране. */
async function loadCourse(): Promise<void> {
  course.value = await fetchCatalogCourse(String(route.params.id));
}

// Живое обновление: администратор правит курс — карточка показывает новое.
useLiveReload([EduLive.courses], loadCourse);

onMounted(async () => {
  try {
    await loadCourse();
    if (course.value) desktopStore.setPageTitleOverride('Курс');
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
});
onBeforeUnmount(() => desktopStore.clearPageTitleOverride());
</script>

<style scoped>
.edu-course__guest {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-3);
}
.edu-course__about :deep(.base-card__body) {
  display: flex;
  flex-direction: column;
  gap: var(--p-6);
  padding: var(--p-6);
}
.edu-course__section-title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
  margin-bottom: var(--p-2);
}
.edu-course__text {
  white-space: pre-wrap;
  max-width: 68ch;
  font-size: var(--p-fs-body);
  line-height: 1.6;
}
.edu-course__teachers {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  font-size: var(--p-fs-body);
}
</style>
