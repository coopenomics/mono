<template lang="pug">
.q-pa-md
  CardListSkeleton(v-if="firstLoad" :count="1")

  EmptyState(v-else-if="!course" title="Курс не найден" body="Возможно, курс удалён из реестра.")
    template(#icon)
      q-icon(name="search_off" size="40px")

  template(v-else)
    BaseButton.edu-course__back(variant="ghost" size="sm" @click="goBack")
      template(#icon-left)
        q-icon(name="arrow_back" size="16px")
      | К реестру курсов

    CourseHero(:title="course.title" :subject="course.subject" :grade="course.grade" :image-url="course.image_url")
      template(#facts)
        BaseBadge(:variant="status.variant") {{ status.label }}
        span(v-if="course.schedule") {{ course.schedule }}
        span(v-if="course.starts_at") занятия с {{ formatDate(course.starts_at) }}
      template(#actions)
        .edu-course__buttons
          BaseButton(v-if="published" variant="secondary" :loading="busy" @click="unpublish") Снять с публикации
          BaseButton(v-else variant="secondary" :loading="busy" @click="setStatus(Zeus.EduCourseStatus.PUBLISHED)") Опубликовать
          BaseButton(variant="primary" @click="edit") Изменить
          //- Отмена набора — решение с последствиями, поэтому она лежит под
          //- кнопкой «ещё», а не рядом с обычными действиями.
          BaseButton(v-if="!started" variant="ghost" icon-only aria-label="Ещё действия")
            template(#icon-left)
              q-icon(name="more_horiz" size="20px")
            q-menu(anchor="bottom right" self="top right")
              q-list.edu-course__menu(dense)
                q-item(clickable v-close-popup :disable="cancelling" @click="cancelUnderfilled")
                  q-item-section.text-negative Отменить по недобору
      CourseHeroFigure(caption="взнос в месяц")
        FeeAmount(:value="course.fee_month" size="lg")
      CourseHeroFigure(:value="course.lessons_per_month" :caption="`${pluralize(Number(course.lessons_per_month), LESSON_FORMS)} в месяц по ${course.lesson_minutes} мин`")
      CourseHeroFigure(:value="course.lessons_total" :caption="`${pluralize(Number(course.lessons_total), LESSON_FORMS)} в программе`")

    .row.q-col-gutter-md
      .col-12.col-md-8
        BaseCard.edu-course__about(variant="default")
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
            DataRow(label="Гарантийный срок" :value="`${course.guarantee_days} ${pluralizeDays(Number(course.guarantee_days))}`" align="spread")
            DataRow(v-if="course.external_ref" label="Курс на площадке" :value="course.external_ref" align="vertical" mono copyable)

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
import { DataRow, IdentityCell } from 'src/shared/ui/domain';
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
import { LESSON_FORMS } from '../../shared/lib/courseMonths';
import { FeeAmount } from '../../shared/ui/FeeAmount';
import { CourseHero, CourseHeroFigure } from '../../widgets/CourseHero';

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
    title: 'Снять курс с публикации?',
    message: `Курс «${course.value.title}» пропадёт из каталога, новые подписки на него станут недоступны. Действующие подписки продолжат работать.`,
    confirmLabel: 'Снять с публикации',
  });
  if (agreed) await setStatus(Zeus.EduCourseStatus.DRAFT);
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    course.value = await fetchCourse(String(route.params.id));
    if (course.value) desktopStore.setPageTitleOverride('Курс');
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
.edu-course__back {
  margin: 0 0 var(--p-3) calc(-1 * var(--p-2));
}
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
.edu-course__menu {
  min-width: 220px;
}
</style>
