<template lang="pug">
.q-pa-md
  CardListSkeleton(v-if="firstLoad" :count="1")

  EmptyState(v-else-if="!course" :title="$t('edubridge.courseCardPage.notFoundTitle')" :body="$t('edubridge.courseCardPage.notFoundBody')")
    template(#icon)
      q-icon(name="search_off" size="40px")

  template(v-else)
    CourseHero(:title="course.title" :section="course.section_title" :level="course.level_title" :image-url="course.image_url")
      template(#facts)
        span(v-if="course.schedule") {{ course.schedule }}
        span(v-if="course.starts_at") {{ $t('edubridge.courseCardPage.startsFrom', { date: formatDate(course.starts_at) }) }}
      template(#actions)
        //- Доступ уже оплачен: срок виден, главное действие — продление; записать ещё одного обучающегося — рядом.
        template(v-if="paidUntil")
          .edu-course__access
            BaseBadge(variant="pos") {{ $t('edubridge.courseCardPage.accessPaidUntil', { date: formatDate(paidUntil) }) }}
            .edu-course__due(v-if="renewSoon") {{ $t('edubridge.courseCardPage.daysLeft', { n: left }, Number(left)) }}
          BaseButton(variant="primary" @click="getAccess") {{ $t('edubridge.courseCardPage.extend') }}
        BaseButton(v-else variant="primary" @click="getAccess") {{ $t('edubridge.courseCardPage.getAccess') }}
        .edu-course__guest(v-if="!session.isAuth") {{ $t('edubridge.courseCardPage.guestHint') }}
      //- Обе полные суммы рядом: скидка видна как разница в рублях, а не как
      //- цена «от …», которую участник ни разу не вносит.
      CourseHeroFigure(:caption="$t('edubridge.courseCardPage.feeMonthCaption')")
        FeeAmount(:value="course.fee_month" size="lg")
      CourseHeroFigure(v-if="course.fee_course" :caption="$t('edubridge.courseCardPage.feeCourseCaption')")
        FeeAmount(:value="course.fee_course" size="lg")
      CourseHeroFigure(:value="course.lessons_per_month" :caption="$t('edubridge.course.lessonsPerMonthCaption', { minutes: course.lesson_minutes }, Number(course.lessons_per_month))")
      CourseHeroFigure(:value="course.lessons_total" :caption="$t('edubridge.course.lessonsTotalCaption', Number(course.lessons_total))")

    .row.q-col-gutter-md
      .col-12(:class="course.teacher_usernames.length ? 'col-md-8' : ''")
        BaseCard.edu-course__about(variant="default")
          section
            .edu-course__section-title {{ $t('edubridge.courseCardPage.aboutTitle') }}
            .edu-course__text(v-if="course.description") {{ course.description }}
            .t-muted.t-sm(v-else) {{ $t('edubridge.courseCardPage.descriptionEmpty') }}
          section
            .edu-course__section-title {{ $t('edubridge.courseCardPage.syllabusTitle') }}
            .edu-course__text(v-if="course.syllabus") {{ course.syllabus }}
            .t-muted.t-sm(v-else) {{ $t('edubridge.courseCardPage.syllabusEmpty') }}

      .col-12.col-md-4(v-if="course.teacher_usernames.length")
        BaseCard(variant="default" :title="course.teacher_usernames.length > 1 ? $t('edubridge.courseCardPage.teachersTitleMany') : $t('edubridge.courseCardPage.teachersTitleOne')")
          .edu-course__teachers
            .edu-course__teacher(v-for="username in course.teacher_usernames" :key="username") {{ fioCache.get(username) || username }}

    //- Гарантийные условия видит участник с подпиской на этот курс.
    GuaranteeClaim.q-mt-md(v-if="canSeeGuarantee" :course-id="asText(course.id)")

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
import { useFirstLoad } from 'src/shared/lib/composables';
import { BaseBadge, BaseButton, BaseCard, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { fetchCatalogCourse, type ICatalogCourse } from '../../entities/Course';
import { fetchMyLearners, type ILearner, fetchMyEnrollments, type IEnrollment } from '../../entities/Learner';
import { RENEW_SOON_DAYS, daysLeft, isLiveEnrollment } from '../../shared/lib/subscriptionDue';
import { SubscribeDialog } from '../../features/Subscribe';
import { GuaranteeClaim } from '../../features/Guarantee';
import { FeeAmount } from '../../shared/ui/FeeAmount';
import { CourseHero, CourseHeroFigure } from '../../widgets/CourseHero';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

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
// Каркас — только до конца первой загрузки: обновление по ленте изменений страницу не прячет.
const firstLoad = useFirstLoad(loading);
const subscribeOpen = ref(false);
/** Мои действующие подписки на этот курс: по ним видно, что доступ уже оплачен и до какого дня. */
const ownEnrollments = ref<IEnrollment[]>([]);
/** Самый поздний оплаченный срок среди них. */
const paidUntil = computed(() => {
  const dates = ownEnrollments.value.map((e) => (e.paid_until ? new Date(String(e.paid_until)).getTime() : 0)).filter(Boolean);
  return dates.length ? new Date(Math.max(...dates)) : null;
});
const left = computed(() => daysLeft(paidUntil.value));
const renewSoon = computed(() => left.value !== null && left.value <= RENEW_SOON_DAYS);
const learners = ref<ILearner[]>([]);
/** Свои подписки читает только участник, подписавший оферту ученика. */
const canSeeGuarantee = computed(() => session.isAuth && desktopStore.hasGrant('edubridge-member', 'EduEnrollment:read:own'));
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
  // Оферта ученика не подписана — бэкенд откажет в подписке, поэтому
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
  await loadOwnEnrollments();
}

/** Свои подписки на курс читает участник с офертой ученика; гостю и остальным кнопка остаётся «Получить доступ». */
async function loadOwnEnrollments(): Promise<void> {
  if (!canSeeGuarantee.value) return;
  try {
    const id = String(route.params.id);
    ownEnrollments.value = (await fetchMyEnrollments()).filter((e) => asText(e.course_id) === id && isLiveEnrollment(e));
  } catch {
    ownEnrollments.value = [];
  }
}

// Живое обновление: администратор правит курс — карточка показывает новое.
useLiveReload([EduLive.courses, EduLive.enrollments], loadCourse);

onMounted(async () => {
  try {
    await loadCourse();
    if (course.value) desktopStore.setPageTitleOverride(t('edubridge.courseCardPage.pageTitle'));
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
.edu-course__access {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--p-1);
}
.edu-course__due {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-warn);
}
</style>
