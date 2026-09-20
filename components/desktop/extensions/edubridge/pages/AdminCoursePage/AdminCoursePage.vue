<template lang="pug">
.q-pa-md
  BaseButton.edu-course-admin__back(variant="ghost" size="sm" @click="goBack")
    template(#icon-left)
      q-icon(name="arrow_back" size="16px")
    | К реестру курсов

  CardListSkeleton(v-if="firstLoad" :count="1")

  EmptyState(v-else-if="!course" title="Курс не найден" body="Возможно, курс удалён из реестра.")
    template(#icon)
      q-icon(name="search_off" size="40px")

  template(v-else)
    //- Шапка: название курса, предмет с классом и состояние — одной строкой,
    //- рядом действия. Курс узнаётся с первого взгляда, а не по меткам.
    .edu-course__head
      .edu-course__head-text
        .t-eyebrow {{ course.subject }} · {{ course.grade }}
        .edu-course__title {{ course.title }}
        .edu-course__facts
          BaseBadge(:variant="status.variant") {{ status.label }}
          span.t-sm.t-muted(v-if="course.starts_at") Занятия с {{ formatDate(course.starts_at) }}
          span.t-sm.t-muted(v-if="course.schedule") {{ course.schedule }}
      .edu-course__actions
        BaseButton(variant="primary" @click="editOpen = true") Изменить курс
        BaseButton(v-if="published" variant="secondary" :loading="busy" @click="setStatus(Zeus.EduCourseStatus.DRAFT)") Снять с публикации
        BaseButton(v-else variant="secondary" :loading="busy" @click="setStatus(Zeus.EduCourseStatus.PUBLISHED)") Опубликовать
        //- Отмена набора — решение с последствиями, поэтому она лежит под
        //- кнопкой «ещё», а не рядом с обычными действиями.
        BaseButton(v-if="!started" variant="ghost" icon-only aria-label="Ещё действия")
          template(#icon-left)
            q-icon(name="more_horiz" size="20px")
          q-menu(anchor="bottom right" self="top right")
            q-list.edu-course__menu(dense)
              q-item(clickable v-close-popup :disable="cancelling" @click="cancelUnderfilled")
                q-item-section.text-negative Отменить по недобору

    //- Главные числа курса одной полосой: взносы и нагрузка читаются сразу,
    //- без поиска по боковым карточкам.
    BaseCard.edu-course__summary(variant="default")
      .edu-course__metrics
        .edu-course__metric
          .t-meta Взнос в месяц
          FeeAmount(:value="course.fee_month" size="lg")
        .edu-course__metric
          .t-meta Взнос за весь курс разом
          FeeAmount(v-if="course.fee_course" :value="course.fee_course" size="lg")
          .edu-course__metric-value(v-else)
            span.edu-course__metric-unit принимается только помесячный
          .t-meta.t-faint(v-if="course.fee_course && course.course_discount_amount") меньше суммы помесячных на {{ formatAsset2Digits(course.course_discount_amount) }}
        .edu-course__metric
          .t-meta Нагрузка в месяц
          .edu-course__metric-value
            span.edu-course__metric-num {{ course.lessons_per_month }}
            span.edu-course__metric-unit {{ pluralize(Number(course.lessons_per_month), LESSON_FORMS) }} по {{ course.lesson_minutes }} мин
        .edu-course__metric
          .t-meta Программа
          .edu-course__metric-value
            span.edu-course__metric-num {{ course.lessons_total }}
            span.edu-course__metric-unit {{ pluralize(Number(course.lessons_total), LESSON_FORMS) }}
          .t-meta.t-faint(v-if="months") курс длится {{ months }}

    .row.q-col-gutter-md
      .col-12.col-md-8
        BaseCard.edu-course__about(variant="default")
          q-img.edu-course__cover(v-if="course.image_url" :src="course.image_url" :ratio="3 / 1" fit="cover" no-spinner)
          .edu-course__about-body
            section
              .edu-course__section-title О курсе
              .edu-course__text(v-if="course.description") {{ course.description }}
              .t-muted.t-sm(v-else) Описание не заполнено — в каталоге его место останется пустым.
            section
              .edu-course__section-title Учебная программа
              .edu-course__text(v-if="course.syllabus") {{ course.syllabus }}
              .t-muted.t-sm(v-else) Программа не заполнена.

      .col-12.col-md-4
        .edu-course__side
          //- Из чего сложился взнос и покрывает ли он обязательства перед теми,
          //- кто курс ведёт: плановый расчёт против ставок преподавателей.
          BaseCard(v-if="economy" variant="default" title="Экономика курса")
            DataRow(label="Себестоимость в месяц" :value="formatAsset2Digits(economy.plan.cost_month)" align="spread")
            DataRow(:label="`Наценка, ${economy.plan.markup_percent}%`" :value="formatAsset2Digits(economy.plan.markup_month)" align="spread")
            DataRow(label="Ставка часа по программе" :value="formatAsset2Digits(course.planned_hourly_rate)" align="spread")
            DataRow(label="По ставкам преподавателей" :value="formatAsset2Digits(economy.actual_cost_month)" align="spread")
            BaseBanner.q-mt-sm(v-if="economy.over_fee" variant="warn")
              template(#icon)
                q-icon(name="warning_amber")
              | Обязательства перед преподавателями больше собранного взноса — поднимите ставку часа или пересмотрите нагрузку.

          BaseCard(variant="default" title="Курс ведут")
            .edu-course__teachers(v-if="course.teacher_usernames.length")
              IdentityCell(v-for="username in course.teacher_usernames" :key="username" :account-name="username" :full-name="fioCache.get(username) || null")
            .t-muted.t-sm(v-else) Преподаватели не назначены — назначения оформляются на странице «Преподаватели».

          BaseCard(variant="default" title="Выдача доступа")
            DataRow(label="Направление" :value="directionLabel" align="spread")
            DataRow(label="Площадка" :value="carrierLabel" align="spread")
            DataRow(label="Гарантия материалов" :value="`${course.guarantee_days} ${pluralizeDays(Number(course.guarantee_days))}`" align="spread")
            DataRow(v-if="course.external_ref" label="Курс на площадке" :value="course.external_ref" align="vertical" mono copyable)

  //- Правка курса идёт в правой панели: так стол остаётся на виду, а форма
  //- открывается и закрывается на месте — общий порядок платформы.
  DetailsDrawer(v-model="editOpen" title="Изменить курс" :width="720")
    CourseForm(ref="formRef" :course="course" hide-footer @saved="onSaved" @busy="(v) => (saving = v)")
    template(#footer)
      .row.justify-end.q-gutter-sm
        BaseButton(variant="ghost" :disabled="saving" @click="editOpen = false") Отменить
        BaseButton(variant="primary" :loading="saving" @click="submitForm") Сохранить
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { asText, pluralize, pluralizeDays } from 'src/shared/lib/utils';
import { useConfirm, useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useFioCache } from 'src/shared/lib/account/useFioCache';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseBanner, BaseButton, BaseCard, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, IdentityCell } from 'src/shared/ui/domain';
import {
  CARRIER_LABELS,
  COURSE_STATUS_LABELS,
  DIRECTION_LABELS,
  cancelCourseUnderfilled,
  fetchCourse,
  setCourseStatus,
  type ICourse,
} from '../../entities/Course';
import { fetchCourseEconomy, type ICourseEconomy } from '../../entities/Economy';
import { CourseForm } from '../../widgets/CourseForm';
import { courseMonthsLabel } from '../../shared/lib/courseMonths';
import { FeeAmount } from '../../shared/ui/FeeAmount';

/**
 * Курс глазами администратора на отдельной странице: открывается кликом по
 * карточке в реестре. Всё управление курсом собрано здесь — под карточками
 * реестра кнопок нет, там только витрина.
 */
const LESSON_FORMS: [string, string, string] = ['занятие', 'занятия', 'занятий'];

const route = useRoute();
const router = useRouter();
const desktopStore = useDesktopStore();
const { fioCache, enrichFio } = useFioCache();
const { confirm } = useConfirm();

const course = ref<ICourse | null>(null);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);
const saving = ref(false);
const editOpen = ref(false);
const formRef = ref<InstanceType<typeof CourseForm> | null>(null);
const economy = ref<ICourseEconomy | null>(null);
const cancelling = ref(false);
// Пока занятия не начались, набор можно отменить: после первого занятия у
// участников остаётся отказ от подписки, а не отмена курса.
const started = computed(() => Boolean(course.value?.starts_at) && new Date(String(course.value?.starts_at)) <= new Date());
const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('ru-RU') : '______');

const months = computed(() => courseMonthsLabel(course.value?.course_months));
const status = computed(() => COURSE_STATUS_LABELS[course.value?.status ?? ''] ?? { label: course.value?.status ?? '', variant: 'neutral' as const });
const published = computed(() => course.value?.status === Zeus.EduCourseStatus.PUBLISHED);
const carrierLabel = computed(() => CARRIER_LABELS[course.value?.carrier ?? ''] ?? course.value?.carrier ?? '______');
const directionLabel = computed(() => DIRECTION_LABELS[course.value?.direction ?? ''] ?? course.value?.direction ?? '______');

function goBack(): void {
  void router.push({ name: 'edubridge-admin-courses', params: { coopname: route.params.coopname } });
}

function submitForm(): void {
  void formRef.value?.submit();
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    course.value = await fetchCourse(String(route.params.id));
    if (course.value) desktopStore.setPageTitleOverride(course.value.title);
    economy.value = await fetchCourseEconomy(String(route.params.id));
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

async function onSaved(updated: ICourse): Promise<void> {
  course.value = updated;
  desktopStore.setPageTitleOverride(updated.title);
  editOpen.value = false;
  // Параметры изменились — расчёт пересобираем, иначе на странице остаётся прежний.
  try {
    economy.value = await fetchCourseEconomy(asText(updated.id));
  } catch (e) {
    FailAlert(e);
  }
}

async function cancelUnderfilled(): Promise<void> {
  if (!course.value) return;
  const agreed = await confirm({
    title: 'Отменить курс по недобору?',
    message: `Подписки участников курса «${course.value.title}» закроются, взносы вернутся им на паевой, доступ к материалам будет отозван.`,
    note: 'Отменить это решение нельзя — участникам придётся подписаться заново.',
    confirmLabel: 'Отменить курс',
    danger: true,
  });
  if (!agreed) return;
  cancelling.value = true;
  try {
    const count = await cancelCourseUnderfilled(asText(course.value.id));
    SuccessAlert(count > 0 ? `Курс отменён, возвращено подписок: ${count}` : 'Курс отменён — подписок не было');
  } catch (e) {
    FailAlert(e);
  } finally {
    cancelling.value = false;
  }
}

async function setStatus(next: ICourse['status']): Promise<void> {
  if (!course.value) return;
  busy.value = true;
  try {
    course.value = await setCourseStatus({ id: course.value.id, status: next });
    SuccessAlert(next === Zeus.EduCourseStatus.PUBLISHED ? 'Курс опубликован' : 'Курс снят с публикации');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
onBeforeUnmount(() => desktopStore.clearPageTitleOverride());
</script>

<style scoped>
.edu-course-admin__back {
  align-self: flex-start;
  margin-bottom: var(--p-3);
}
.edu-course__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--p-4);
  flex-wrap: wrap;
  margin-bottom: var(--p-4);
}
.edu-course__head-text {
  min-width: 0;
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
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-2);
  margin-top: var(--p-2);
}
.edu-course__actions {
  display: flex;
  align-items: center;
  gap: var(--p-2);
}
/* Полоса главных чисел: ячейки делятся тонкими линиями. Линию рисует левая и
   верхняя граница ячейки, лишние у края срезает overflow — так сетка остаётся
   ровной и когда ячейки переносятся на вторую строку. */
.edu-course__summary {
  margin-bottom: var(--p-4);
  overflow: hidden;
}
.edu-course__summary :deep(.base-card__body) {
  padding: 0;
}
.edu-course__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  margin: -1px 0 0 -1px;
}
.edu-course__metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: var(--p-4) var(--p-5);
  border-left: 1px solid var(--p-line);
  border-top: 1px solid var(--p-line);
}
.edu-course__metric-value {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3em;
  white-space: nowrap;
  font-size: var(--p-fs-h1, 24px);
  line-height: 1.15;
  font-feature-settings: 'tnum' 1;
}
.edu-course__metric-num {
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--p-ink);
}
.edu-course__metric-unit {
  font-size: var(--p-fs-body-sm, 13px);
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
.edu-course__menu {
  min-width: 220px;
}
</style>
