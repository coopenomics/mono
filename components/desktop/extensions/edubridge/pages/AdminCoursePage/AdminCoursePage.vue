<template lang="pug">
.q-pa-md
  CardListSkeleton(v-if="firstLoad" :count="1")

  EmptyState(v-else-if="!course" :title="$t('edubridge.adminCoursePage.notFoundTitle')" :body="$t('edubridge.adminCoursePage.notFoundBody')")
    template(#icon)
      q-icon(name="search_off" size="40px")

  template(v-else)
    CourseHero(:title="course.title" :section="course.section_title" :level="course.level_title" :image-url="course.image_url" :back-label="$t('edubridge.adminCoursePage.backToRegistry')" @back="goBack")
      template(#facts)
        BaseBadge(:variant="status.variant") {{ status.label }}
        span(v-if="course.schedule") {{ course.schedule }}
        span(v-if="course.starts_at") {{ $t('edubridge.adminCoursePage.startsAtFact', { date: formatDate(course.starts_at) }) }}
      template(#actions)
        .edu-course__buttons
          //- «Изменить» — слева и обычная; справа главное действие над публикацией курса.
          BaseButton(variant="secondary" @click="edit") {{ $t('edubridge.adminCoursePage.editButton') }}
          BaseButton(v-if="published" variant="primary" :loading="busy" @click="unpublish") {{ $t('edubridge.adminCoursePage.unpublishButton') }}
          BaseButton(v-else variant="primary" :loading="busy" @click="setStatus(Zeus.EduCourseStatus.PUBLISHED)") {{ $t('edubridge.adminCoursePage.publishButton') }}
          //- Отмена набора и удаление — решения с последствиями, поэтому они лежат
          //- под кнопкой «ещё», а не рядом с обычными действиями. Меню — в слоте
          //- #menu: содержимое кнопки-иконки не рисуется.
          BaseButton(variant="ghost" icon-only :aria-label="$t('edubridge.adminCoursePage.moreActionsAriaLabel')")
            template(#icon-left)
              q-icon(name="more_horiz" size="20px")
            template(#menu)
              q-menu(anchor="bottom right" self="top right")
                q-list.edu-course__menu(dense)
                  q-item(v-if="!started" clickable v-close-popup :disable="cancelling" @click="cancelUnderfilled")
                    q-item-section.text-negative {{ $t('edubridge.adminCoursePage.cancelUnderfilledMenuItem') }}
                  q-item(clickable v-close-popup :disable="deleting" @click="removeCourse")
                    q-item-section.text-negative {{ $t('edubridge.adminCoursePage.deleteMenuItem') }}
      //- Числа курса — те же и в том же порядке, что видит ученик в каталоге.
      StatTile(:caption="$t('edubridge.course.feeMonthCaption')")
        FeeAmount(:value="course.fee_month" size="lg")
      StatTile(v-if="course.fee_course" :caption="$t('edubridge.course.feeCourseCaption')")
        FeeAmount(:value="course.fee_course" size="lg")
      StatTile(:value="course.lessons_per_month" :caption="$t('edubridge.course.lessonsPerMonthCaption', { minutes: course.lesson_minutes }, Number(course.lessons_per_month))")
      StatTile(:value="course.lessons_total" :caption="$t('edubridge.course.lessonsTotalCaption', Number(course.lessons_total))")

    //- Группы курса — на всю ширину под шапкой: набор идёт в группу, деньги и
    //- занятия считаются внутри неё. В узкой колонке реестр не помещается.
    CourseGroups.q-mb-md(:course="course" @changed="reloadEconomy")

    .row.q-col-gutter-md
      .col-12.col-md-8
        BaseCard.edu-course__about(variant="default")
          .edu-course__about-body
            section
              .edu-course__section-title {{ $t('edubridge.adminCoursePage.aboutTitle') }}
              .edu-course__text(v-if="course.description") {{ course.description }}
              .t-muted.t-sm(v-else) {{ $t('edubridge.adminCoursePage.descriptionEmpty') }}
            section
              .edu-course__section-title {{ $t('edubridge.adminCoursePage.syllabusTitle') }}
              .edu-course__text(v-if="course.syllabus") {{ course.syllabus }}
              .t-muted.t-sm(v-else) {{ $t('edubridge.adminCoursePage.syllabusEmpty') }}

      .col-12.col-md-4
        .edu-course__side
          BaseCard(variant="default" :title="$t('edubridge.adminCoursePage.teachersTitle')")
            .edu-course__teachers(v-if="course.teacher_usernames.length")
              .edu-course__teacher(v-for="username in course.teacher_usernames" :key="username")
                //- Имя и учётное имя — одной строкой: в узкой карточке столбик из трёх строк растягивает её.
                .edu-course__teacher-line
                  span.edu-course__teacher-name(v-if="fioCache.get(username)") {{ fioCache.get(username) }}
                  AccountBadge(:account-name="username" size="sm" copyable)
                //- Ставка на этом курсе — у допуска; правится в карточке преподавателя.
                .t-meta.t-muted(v-if="teacherRate(username)") {{ $t('edubridge.adminCoursePage.teacherRateLine', { rate: formatAsset2Digits(teacherRate(username)) }) }}
            .t-muted.t-sm(v-else) {{ $t('edubridge.adminCoursePage.teachersEmpty') }}

          //- Экономика двумя равными частями с одинаковыми подзаголовками: что заложено
          //- во взнос одного участника и что получается по группе за месяц. Подписи —
          //- в одну строку, пояснения — под значком вопроса.
          BaseCard(v-if="economy" variant="default" :title="$t('edubridge.adminCoursePage.economyTitle')")
            .t-eyebrow.q-mb-xs {{ $t('edubridge.adminCoursePage.perLearnerTitle') }}
            DataRow(:label="$t('edubridge.adminCoursePage.plannedHourlyRateLabel')" :value="formatAsset2Digits(course.planned_hourly_rate)" align="spread")
              template(#label-append)
                FieldHelp(:text="$t('edubridge.adminCoursePage.economyHelp.plannedHourlyRate')")
            DataRow(:label="$t('edubridge.adminCoursePage.costMonthLabel')" :value="formatAsset2Digits(economy.plan.cost_month)" align="spread")
              template(#label-append)
                FieldHelp(:text="$t('edubridge.adminCoursePage.economyHelp.costMonth')")
            DataRow(:label="$t('edubridge.adminCoursePage.actualCostMonthLabel')" :value="formatAsset2Digits(economy.actual_cost_month)" align="spread")
              template(#label-append)
                FieldHelp(:text="economy.pay_per_learner ? $t('edubridge.adminCoursePage.economyHelp.actualCostMonthPerLearner') : $t('edubridge.adminCoursePage.economyHelp.actualCostMonth')")
            DataRow(:label="$t('edubridge.adminCoursePage.markupLabel')" :value="formatAsset2Digits(economy.plan.markup_month)" align="spread")
              template(#label-append)
                FieldHelp(:text="$t('edubridge.adminCoursePage.economyHelp.markup', { percent: economy.plan.markup_percent })")

            DataRow(:label="$t('edubridge.adminCoursePage.payModeLabel')" :value="course.pay_per_learner ? $t('edubridge.adminCoursePage.payModePerLearner') : $t('edubridge.adminCoursePage.payModeFixed')" align="spread")

            //- Сумма по всем идущим группам курса; экономика одной группы — в её правой панели.
            .t-eyebrow.q-mt-lg.q-mb-xs {{ $t('edubridge.adminCoursePage.groupTitle') }}
            DataRow(:label="$t('edubridge.adminCoursePage.groupLearnersLabel')" :value="String(economy.learners_active)" align="spread")
              template(#label-append)
                FieldHelp(:text="$t('edubridge.adminCoursePage.economyHelp.groupLearners')")
            DataRow(:label="$t('edubridge.adminCoursePage.groupFeeLabel')" :value="formatAsset2Digits(economy.group_fee_month)" align="spread")
            DataRow(:label="$t('edubridge.adminCoursePage.groupTeachersLabel')" :value="formatAsset2Digits(economy.group_teachers_month)" align="spread")
              template(#label-append)
                FieldHelp(:text="economy.pay_per_learner ? $t('edubridge.adminCoursePage.economyHelp.groupTeachersPerLearner') : $t('edubridge.adminCoursePage.economyHelp.groupTeachersFixed')")
            DataRow(:label="$t('edubridge.adminCoursePage.groupProgramLabel')" :value="formatAsset2Digits(economy.group_program_month)" align="spread")
            BaseBanner.q-mt-sm(v-if="economy.over_fee" variant="warn")
              template(#icon)
                q-icon(name="warning_amber")
              | {{ $t('edubridge.adminCoursePage.overFeeWarning') }}

          BaseCard(variant="default" :title="$t('edubridge.adminCoursePage.accessTitle')")
            DataRow(:label="$t('edubridge.adminCoursePage.directionLabel')" :value="directionLabel" align="spread")
            DataRow(:label="$t('edubridge.adminCoursePage.carrierLabel')" :value="carrierLabel" align="spread")
            DataRow(:label="$t('edubridge.adminCoursePage.guaranteeLabel')" :value="`${course.guarantee_days} ${pluralizeDays(Number(course.guarantee_days))}`" align="spread")
            DataRow(v-if="course.external_ref" :label="$t('edubridge.adminCoursePage.externalRefLabel')" :value="course.external_ref" align="vertical" mono copyable)

</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { asText, pluralizeDays } from 'src/shared/lib/utils';
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useFioCache } from 'src/shared/lib/account/useFioCache';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseBanner, BaseButton, BaseCard, CardListSkeleton, EmptyState, FieldHelp } from 'src/shared/ui/base';
import { AccountBadge, DataRow } from 'src/shared/ui/domain';
import {
  CARRIER_LABELS,
  COURSE_STATUS_LABELS,
  DIRECTION_LABELS,
  cancelCourseUnderfilled, deleteCourse,
  fetchCourse,
  setCourseStatus,
  type ICourse,
} from '../../entities/Course';
import { fetchCourseEconomy, type ICourseEconomy } from '../../entities/Economy';
import { CourseGroups } from '../../widgets/CourseGroups';
import { FeeAmount } from '../../shared/ui/FeeAmount';
import { CourseHero } from '../../widgets/CourseHero';
import { StatTile } from '../../shared/ui/StatStrip';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

/**
 * Курс глазами администратора на отдельной странице: открывается кликом по
 * карточке в реестре. Всё управление курсом собрано здесь — под карточками
 * реестра кнопок нет, там только витрина.
 */

const route = useRoute();
const router = useRouter();
const desktopStore = useDesktopStore();
const { fioCache, enrichFio } = useFioCache();
const { confirm } = useConfirm();

const course = ref<ICourse | null>(null);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);
const economy = ref<ICourseEconomy | null>(null);
const cancelling = ref(false);
// Пока занятия не начались, набор можно отменить: после первого занятия у
// участников остаётся отказ от подписки, а не отмена курса.
const started = computed(() => Boolean(course.value?.starts_at) && new Date(String(course.value?.starts_at)) <= new Date());
const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('ru-RU') : '______');

const status = computed(() => COURSE_STATUS_LABELS[course.value?.status ?? ''] ?? { label: course.value?.status ?? '', variant: 'neutral' as const });
const published = computed(() => course.value?.status === Zeus.EduCourseStatus.PUBLISHED);
/** Ставка преподавателя на этом курсе — из расчёта экономики курса. */
const teacherRate = (username: string): string => economy.value?.teachers.find((t) => t.username === username)?.hourly_rate ?? '';
const carrierLabel = computed(() => CARRIER_LABELS[course.value?.carrier ?? ''] ?? course.value?.carrier ?? '______');
const directionLabel = computed(() => DIRECTION_LABELS[course.value?.direction ?? ''] ?? course.value?.direction ?? '______');

function goBack(): void {
  void router.push({ name: 'edubridge-admin-courses', params: { coopname: route.params.coopname } });
}

function edit(): void {
  void router.push({ name: 'edubridge-admin-course-edit', params: { coopname: route.params.coopname, id: String(route.params.id) } });
}

/** Снятие с публикации убирает курс из каталога — спрашиваем, как и другие заметные действия. */
async function unpublish(): Promise<void> {
  if (!course.value) return;
  const agreed = await confirm({
    title: t('edubridge.adminCoursePage.unpublishConfirmTitle'),
    message: t('edubridge.adminCoursePage.unpublishConfirmMessage', { courseTitle: course.value.title }),
    confirmLabel: t('edubridge.adminCoursePage.unpublishConfirmButton'),
  });
  if (agreed) await setStatus(Zeus.EduCourseStatus.DRAFT);
}

/** Экономика курса — сумма по всем идущим группам; перечитывается, когда группы меняются. */
async function reloadEconomy(): Promise<void> {
  if (!course.value) return;
  try {
    economy.value = await fetchCourseEconomy(asText(course.value.id));
  } catch (e) {
    FailAlert(e);
  }
}

/** Страницу покинули: ответы запросов, начатых на ней, больше ничего не меняют. */
let pageLeft = false;

async function load(): Promise<void> {
  // Идентификатор берётся один раз: пока идёт первый запрос, со страницы можно
  // уйти, адрес сменится, и второй запрос ушёл бы с идентификатором «undefined».
  const id = route.params.id ? String(route.params.id) : '';
  if (!id) return;
  loading.value = true;
  try {
    course.value = await fetchCourse(id);
    // Ответ пришёл после ухода со страницы: заголовок шапки уже сброшен, возвращать его нельзя.
    if (pageLeft) return;
    if (course.value) desktopStore.setPageTitleOverride(t('edubridge.adminCoursePage.pageTitle'));
    economy.value = await fetchCourseEconomy(id);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

// Преподаватели в списке — по ФИО: учётное имя остаётся подписью под ним.
watch(
  () => course.value?.teacher_usernames,
  (list) => {
    if (list?.length) void enrichFio(list);
  },
  { immediate: true },
);

async function cancelUnderfilled(): Promise<void> {
  if (!course.value) return;
  const agreed = await confirm({
    title: t('edubridge.adminCoursePage.cancelUnderfilledConfirmTitle'),
    message: t('edubridge.adminCoursePage.cancelUnderfilledConfirmMessage', { courseTitle: course.value.title }),
    note: t('edubridge.adminCoursePage.cancelUnderfilledConfirmNote'),
    confirmLabel: t('edubridge.adminCoursePage.cancelUnderfilledConfirmButton'),
    danger: true,
  });
  if (!agreed) return;
  cancelling.value = true;
  try {
    const count = await cancelCourseUnderfilled(asText(course.value.id));
    SuccessAlert(count > 0 ? t('edubridge.adminCoursePage.cancelledWithRefunds', { count }) : t('edubridge.adminCoursePage.cancelledNoSubscriptions'));
  } catch (e) {
    FailAlert(e);
  } finally {
    cancelling.value = false;
  }
}

const deleting = ref(false);

/** Удаляется курс, по которому ничего не происходило; при подписках и занятиях сервер откажет и объяснит. */
async function removeCourse(): Promise<void> {
  if (!course.value) return;
  const agreed = await confirm({
    title: t('edubridge.adminCoursePage.deleteConfirmTitle'),
    message: t('edubridge.adminCoursePage.deleteConfirmMessage', { courseTitle: course.value.title }),
    confirmLabel: t('edubridge.adminCoursePage.deleteConfirmButton'),
    danger: true,
  });
  if (!agreed) return;
  deleting.value = true;
  try {
    await deleteCourse(asText(course.value.id));
    SuccessAlert(t('edubridge.adminCoursePage.deletedSuccess'));
    goBack();
  } catch (e) {
    FailAlert(e);
  } finally {
    deleting.value = false;
  }
}

async function setStatus(next: ICourse['status']): Promise<void> {
  if (!course.value) return;
  busy.value = true;
  try {
    course.value = await setCourseStatus({ id: course.value.id, status: next });
    SuccessAlert(next === Zeus.EduCourseStatus.PUBLISHED ? t('edubridge.adminCoursePage.publishedSuccess') : t('edubridge.adminCoursePage.unpublishedSuccess'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.courses, EduLive.enrollments], load);

onMounted(load);
onBeforeUnmount(() => {
  pageLeft = true;
  desktopStore.clearPageTitleOverride();
});
</script>

<style scoped>
.edu-course__buttons {
  display: flex;
  align-items: center;
  gap: var(--p-2);
}
/* Обложка идёт от края до края карточки, текст под ней — со своими полями. */
.edu-course__about {
  overflow: hidden;
}
.edu-course__about :deep(.base-card__body) {
  padding: 0;
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
  color: var(--p-ink);
}
.edu-course__side {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
.edu-course__teachers {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.edu-course__teacher-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-1) var(--p-2);
}
.edu-course__teacher-name {
  color: var(--p-ink);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
}
.edu-course__menu {
  min-width: 220px;
}
</style>
