<template lang="pug">
.q-pa-md
  CardListSkeleton(v-if="firstLoad" :count="1")

  EmptyState(v-else-if="!course" :title="$t('edubridge.courseCardPage.notFoundTitle')" :body="$t('edubridge.courseCardPage.notFoundBody')")
    template(#icon)
      q-icon(name="search_off" size="40px")

  template(v-else)
    CourseHero(:title="course.title" :section="course.section_title" :level="course.level_title" :image-url="course.image_url" :back-label="$t('edubridge.courseCardPage.backToCatalog')" @back="goBack")
      template(#facts)
        span(v-if="course.schedule") {{ course.schedule }}
        span(v-if="course.starts_at") {{ $t('edubridge.courseCardPage.startsFrom', { date: formatDate(course.starts_at) }) }}
        //- Длительность программы словами: ученик не делит занятия на месяцы сам.
        span(v-if="programSpan") {{ $t('edubridge.courseCardPage.programSpan', { span: programSpan }) }}
      template(#actions)
        //- Доступ уже оплачен: срок виден. Продление — только у подписки, которую можно продлить:
        //- программа, оплаченная до конца, заканчивается сама. Пока набор открыт, рядом — запись ещё одного обучающегося.
        template(v-if="paidUntil")
          .edu-course__access
            BaseBadge(variant="pos") {{ $t('edubridge.courseCardPage.accessPaidUntil', { date: formatDate(paidUntil) }) }}
            .edu-course__due(v-if="renewable && renewSoon") {{ $t('edubridge.courseCardPage.daysLeft', { n: left }, Number(left)) }}
          .edu-course__buttons
            BaseButton(v-if="!enrollmentClosed" :variant="renewable ? 'secondary' : 'primary'" @click="getAccess('enroll')") {{ $t('edubridge.courseCardPage.enrollAnother') }}
            BaseButton(v-if="renewable" variant="primary" @click="getAccess('extend')") {{ $t('edubridge.courseCardPage.extend') }}
        //- Занятия во всех группах начались — набор закрыт, записаться можно в следующую группу.
        BaseBadge(v-else-if="enrollmentClosed" variant="neutral") {{ $t('edubridge.courseCardPage.enrollmentClosed') }}
        BaseButton(v-else variant="primary" @click="getAccess('enroll')") {{ $t('edubridge.courseCardPage.getAccess') }}
        .edu-course__guest(v-if="!session.isAuth") {{ $t('edubridge.courseCardPage.guestHint') }}
      //- Обе полные суммы рядом: скидка видна как разница в рублях, а не как
      //- цена «от …», которую участник ни разу не вносит.
      //- У программы на месяц взнос один — «за курс». У длинной рядом с месячным стоит полный
      //- взнос за весь курс: разом со скидкой либо сумма помесячных.
      StatTile(:caption="Number(course.course_months) === 1 ? $t('edubridge.course.feeWholeCaption') : $t('edubridge.course.feeMonthCaption')")
        FeeAmount(:value="course.fee_month" size="lg")
      StatTile(v-if="Number(course.course_months) > 1 && (course.fee_course || course.fee_course_base)" :caption="course.fee_course ? $t('edubridge.course.feeCourseCaption') : $t('edubridge.course.feeCourseTotalCaption')")
        FeeAmount(:value="course.fee_course ?? course.fee_course_base ?? ''" size="lg")
      StatTile(:value="lessonsPerMonth" :caption="$t('edubridge.course.lessonsPerMonthCaption')")
      StatTile(:value="hoursPerMonth" :caption="$t('edubridge.course.hoursPerMonthCaption')")
      StatTile(v-if="Number(course.program_months) > 0" :value="programSpanTile" :caption="$t('edubridge.course.programSpanCaption')")

    .row.q-col-gutter-md
      .col-12(:class="hasSide ? 'col-md-8' : ''")
        BaseCard.edu-course__about(variant="default")
          section
            .edu-course__section-title {{ $t('edubridge.courseCardPage.aboutTitle') }}
            .edu-course__text(v-if="course.description") {{ course.description }}
            .t-muted.t-sm(v-else) {{ $t('edubridge.courseCardPage.descriptionEmpty') }}
          section
            .edu-course__section-title {{ $t('edubridge.courseCardPage.syllabusTitle') }}
            .edu-course__text(v-if="course.syllabus") {{ course.syllabus }}
            .t-muted.t-sm(v-else) {{ $t('edubridge.courseCardPage.syllabusEmpty') }}
          //- Ближайшие занятия группы, в которую записан обучающийся: из календаря группы.
          section(v-if="nextLessons.length")
            .edu-course__section-title {{ $t('edubridge.courseCardPage.nextLessonsTitle') }}
            .edu-course__lessons
              .edu-course__lesson(v-for="l in nextLessons" :key="asText(l.id)")
                span.edu-course__lesson-moment {{ formatLessonMoment(l.held_at) }}
                span.t-muted.t-sm {{ l.topic || $t('edubridge.lesson.numberShort', { number: l.lesson_number }) }}

      .col-12.col-md-4(v-if="hasSide")
        BaseCard(variant="default" :title="course.teacher_usernames.length > 1 ? $t('edubridge.courseCardPage.teachersTitleMany') : $t('edubridge.courseCardPage.teachersTitleOne')")
          .edu-course__teachers
            .edu-course__teacher(v-for="username in course.teacher_usernames" :key="username") {{ fioCache.get(username) || username }}

    SubscribeDialog(
      v-model="subscribeOpen"
      :learners="learners"
      :courses="course ? [course] : []"
      :locked-course-id="asText(course?.id) || null"
      :locked-group-id="dialogMode === 'extend' ? asText(renewableEnrollment?.group_id) || null : null"
      :preferred-learner-id="dialogMode === 'extend' ? asText(renewableEnrollment?.learner_id) || null : null"
      :enrolled="dialogMode === 'enroll' ? ownEnrollments : []"
      @learner-added="onLearnerAdded"
      @subscribed="onSubscribed"
    )
</template>

<script setup lang="ts">
import { fetchOpenGroups } from '../../entities/Group';
import { fetchGroupLessons, formatLessonMoment, type ICalendarLesson } from '../../entities/Lesson';
import { Zeus } from '@coopenomics/sdk';
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
import { ACCESS_QUERY, accessModeOf, type AccessMode } from '../../shared/lib/accessIntent';
import { programSpanCompact, programSpanLabel } from '../../shared/lib/courseMonths';
import { SubscribeDialog } from '../../features/Subscribe';
import { FeeAmount } from '../../shared/ui/FeeAmount';
import { CourseHero } from '../../widgets/CourseHero';
import { StatTile } from '../../shared/ui/StatStrip';
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
/** Ближайшие занятия группы по моей подписке: три запланированных от текущего момента. */
const groupLessons = ref<ICalendarLesson[]>([]);
const nextLessons = computed(() => {
  const now = Date.now();
  return groupLessons.value
    .filter((l) => l.status === Zeus.EduLessonStatus.PLANNED && new Date(String(l.held_at)).getTime() >= now)
    .sort((a, b) => String(a.held_at).localeCompare(String(b.held_at)))
    .slice(0, 3);
});
watch(
  () => ownEnrollments.value.map((e) => asText(e.group_id)).filter(Boolean)[0] ?? null,
  async (groupId) => {
    groupLessons.value = groupId ? await fetchGroupLessons(groupId).catch(() => []) : [];
  },
);
/** Самый поздний оплаченный срок среди них. */
const paidUntil = computed(() => {
  const dates = ownEnrollments.value.map((e) => (e.paid_until ? new Date(String(e.paid_until)).getTime() : 0)).filter(Boolean);
  return dates.length ? new Date(Math.max(...dates)) : null;
});
const programSpan = computed(() => programSpanLabel(course.value?.program_months));
/** Правая колонка нужна, когда есть кого назвать. */
const hasSide = computed(() => Boolean(course.value?.teacher_usernames.length));
const left = computed(() => daysLeft(paidUntil.value));
const renewSoon = computed(() => left.value !== null && left.value <= RENEW_SOON_DAYS);
/** Подписка, которую можно продлить: программа идёт дальше оплаченного срока. Первой берётся та, что кончается раньше. */
const renewableEnrollment = computed(
  () => [...ownEnrollments.value].filter((e) => e.renewable).sort((a, b) => String(a.paid_until).localeCompare(String(b.paid_until)))[0] ?? null,
);
const renewable = computed(() => Boolean(renewableEnrollment.value));
/** Зачем открыто окно подписки: записать обучающегося либо продлить действующую подписку. */
const dialogMode = ref<'enroll' | 'extend'>('enroll');
const learners = ref<ILearner[]>([]);
/** Набор закрыт: групп с открытым набором у курса нет. Пока группы не прочитаны — кнопка остаётся. */
const enrollmentClosed = ref(false);
/** Свои подписки читает только участник, подписавший оферту ученика. */
const canSeeGuarantee = computed(() => session.isAuth && desktopStore.hasGrant('edubridge-member', 'EduEnrollment:read:own'));
const { fioCache, enrichFio } = useFioCache();
/** Длительность программы для плитки: «9 месяцев», «3 мес. 2 нед.». */
const programSpanTile = computed(() => programSpanCompact(course.value?.program_months));
/** Занятий и часов в месяц — по окнам расписания на четыре недели месяца. */
const lessonsPerMonth = computed(() => Number(course.value?.lessons_per_month || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 }));
const hoursPerMonth = computed(() => (Number(course.value?.minutes_per_month || 0) / 60).toLocaleString('ru-RU', { maximumFractionDigits: 2 }));
const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('ru-RU') : '______');

// Преподаватель посетителю — по имени: учётное имя ничего ему не говорит.
watch(
  () => course.value?.teacher_usernames,
  (list) => {
    if (list?.length) void enrichFio(list);
  },
);

/** Назад в каталог: страница курса открывается из него. */
function goBack(): void {
  void router.push({ name: 'edubridge-catalog', params: { coopname: route.params.coopname } });
}

async function getAccess(mode: AccessMode, resumed = false): Promise<void> {
  dialogMode.value = mode;
  if (!session.isAuth) {
    void router.push({ name: 'signup', params: { coopname: route.params.coopname } });
    return;
  }
  // Оферта ученика не подписана — бэкенд откажет в подписке, поэтому
  // сначала гейт подключения (право `Onboarding:learner` живёт ровно до подписи).
  if (desktopStore.hasGrant('edubridge-member', 'Onboarding:learner')) {
    // Возврат с подписи, а право на шлюз ещё стоит: второй раз на подпись не уводим — иначе круг.
    if (resumed) return;
    // Курс и намерение едут в адресе: после подписи человек возвращается сюда же, к оформлению доступа.
    void router.push({
      name: 'edubridge-member-onboarding',
      params: { coopname: route.params.coopname },
      query: { course: String(route.params.id), [ACCESS_QUERY]: mode },
    });
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
  // Страницу уже покидают, адрес сменился — запрос с идентификатором «undefined» не шлём.
  const id = route.params.id ? String(route.params.id) : '';
  if (!id) return;
  course.value = await fetchCatalogCourse(id);
  await Promise.all([loadOwnEnrollments(), loadEnrollmentState(id)]);
}

async function loadEnrollmentState(courseId: string): Promise<void> {
  try {
    enrollmentClosed.value = !(await fetchOpenGroups(courseId)).length;
  } catch {
    // Группы не прочитаны — о закрытом наборе скажет сервер при оформлении.
    enrollmentClosed.value = false;
  }
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

/**
 * Человек вернулся с подписи оферты: оформление доступа продолжается с места,
 * где его прервала подпись. Намерение из адреса снимается сразу — перезагрузка
 * страницы диалог заново не открывает.
 */
async function resumeAccess(): Promise<void> {
  const mode = accessModeOf(route.query[ACCESS_QUERY]);
  if (!mode) return;
  const { [ACCESS_QUERY]: _intent, ...query } = route.query;
  await router.replace({ name: route.name ?? undefined, params: route.params, query });
  await getAccess(mode, true);
}

// Живое обновление: администратор правит курс — карточка показывает новое.
useLiveReload([EduLive.courses, EduLive.enrollments], loadCourse);

/** Страницу покинули: ответы запросов, начатых на ней, больше ничего не меняют. */
let pageLeft = false;

onMounted(async () => {
  try {
    await loadCourse();
    // Ответ пришёл после ухода со страницы: заголовок шапки уже сброшен, возвращать его нельзя.
    if (course.value && !pageLeft) desktopStore.setPageTitleOverride(t('edubridge.courseCardPage.pageTitle'));
    if (course.value && !pageLeft) await resumeAccess();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
});
onBeforeUnmount(() => {
  pageLeft = true;
  desktopStore.clearPageTitleOverride();
});
</script>

<style scoped>
.edu-course__lessons {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
.edu-course__lesson {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-1) var(--p-3);
  align-items: baseline;
}
.edu-course__lesson-moment {
  font-weight: 600;
  color: var(--p-ink);
}
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
.edu-course__buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--p-2);
}
.edu-course__due {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-warn);
}
</style>
