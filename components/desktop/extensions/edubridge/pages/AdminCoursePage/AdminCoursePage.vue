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

  .row.q-col-gutter-md.q-mt-none(v-else)
    .col-12.col-md-8
      BaseCard(variant="default")
        template(#head)
          //- Метки идут одной строкой и по одной высоте: состояние курса и его
          //- предмет с классом читаются вместе, а не уступами.
          .edu-course-admin__tags
            BaseBadge(:variant="status.variant") {{ status.label }}
            BaseChip(variant="neutral" size="sm") {{ course.subject }}
            BaseChip(variant="neutral" size="sm") {{ course.grade }}
        .edu-course-admin__cover.q-mb-md
          q-img(v-if="course.image_url" :src="course.image_url" :ratio="21 / 9" fit="cover" no-spinner)
          .edu-course-admin__placeholder(v-else)
            q-icon(name="image" size="40px")
        .text-body2.edu-course-admin__text(v-if="course.description") {{ course.description }}
        .t-muted.t-sm(v-else) Описание курса не заполнено — в каталоге его место будет пустым.
        q-separator.q-my-md
        .text-subtitle2.q-mb-sm Учебная программа
        .text-body2.edu-course-admin__text(v-if="course.syllabus") {{ course.syllabus }}
        .t-muted.t-sm(v-else) Программа не заполнена.

    .col-12.col-md-4
      BaseCard.edu-course-admin__side(variant="default" title="Управление")
        .column.q-gutter-sm
          BaseButton(variant="primary" block @click="editOpen = true") Изменить курс
          BaseButton(v-if="published" variant="ghost" block :loading="busy" @click="setStatus(Zeus.EduCourseStatus.DRAFT)") Снять с публикации
          BaseButton(v-else variant="secondary" block :loading="busy" @click="setStatus(Zeus.EduCourseStatus.PUBLISHED)") Опубликовать
          BaseButton(v-if="!started" variant="ghost" block :loading="cancelling" @click="cancelUnderfilled") Отменить по недобору
        .t-muted.t-meta.q-mt-sm {{ published ? 'Курс виден в каталоге всем посетителям.' : 'Черновик виден только на этом столе.' }}
        .t-muted.t-meta.q-mt-xs(v-if="!started") Отмена закрывает подписки участников и возвращает их взносы на паевой.

      BaseCard.q-mt-md(variant="default" title="Условия участия")
        DataRow(label="Взнос в месяц" :value="formatAsset2Digits(course.fee_month)" mono)
        DataRow(label="Взнос в год" :value="formatAsset2Digits(course.fee_year)" mono)
        DataRow(label="Начало занятий" :value="course.starts_at ? formatDate(course.starts_at) : '______'")
        DataRow(label="Занятий в месяц" :value="String(course.lessons_per_month)")
        DataRow(label="Занятий в программе" :value="String(course.lessons_total)")
        DataRow(label="Занятие" :value="`${course.lesson_minutes} минут`")
        DataRow(label="Расписание" :value="course.schedule || '______'")

      //- Из чего сложился взнос и покрывает ли он обязательства перед теми, кто
      //- курс ведёт: плановый расчёт против ставок назначенных преподавателей.
      BaseCard.q-mt-md(v-if="economy" variant="default" title="Экономика курса")
        DataRow(label="Себестоимость в месяц" :value="formatAsset2Digits(economy.plan.cost_month)" mono)
        DataRow(:label="`Наценка кооператива, ${economy.plan.markup_percent}%`" :value="formatAsset2Digits(economy.plan.markup_month)" mono)
        DataRow(label="Ставка часа по программе" :value="formatAsset2Digits(course.planned_hourly_rate)" mono)
        DataRow(label="По ставкам преподавателей" :value="formatAsset2Digits(economy.actual_cost_month)" mono)
        BaseBanner.q-mt-sm(v-if="economy.over_fee" variant="warn")
          template(#icon)
            q-icon(name="warning_amber")
          | Обязательства перед преподавателями больше собранного взноса — поднимите ставку часа по программе или пересмотрите нагрузку.

      BaseCard.q-mt-md(variant="default" title="Выдача доступа")
        DataRow(label="Направление" :value="directionLabel")
        DataRow(label="Площадка" :value="carrierLabel")
        DataRow(v-if="course.external_ref" label="Курс на площадке" :value="course.external_ref" mono copyable)
        DataRow(v-if="course.external_title_seen" label="Название на площадке" :value="course.external_title_seen")

      BaseCard.q-mt-md(variant="default" title="Преподаватели")
        q-list(v-if="course.teacher_usernames.length" separator)
          q-item(v-for="username in course.teacher_usernames" :key="username")
            q-item-section
              IdentityCell(:account-name="username" :full-name="fioCache.get(username) || null")
        .t-muted.t-sm(v-else) Преподаватели не назначены — назначения оформляются на странице «Преподаватели».

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
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useFioCache } from 'src/shared/lib/account/useFioCache';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseBanner, BaseButton, BaseCard, BaseChip, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
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

/**
 * Курс глазами администратора на отдельной странице: открывается кликом по
 * карточке в реестре. Всё управление курсом собрано здесь — под карточками
 * реестра кнопок нет, там только витрина.
 */
const route = useRoute();
const router = useRouter();
const desktopStore = useDesktopStore();
const { fioCache, enrichFio } = useFioCache();

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
.edu-course-admin__tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-2);
}
.edu-course-admin__cover {
  border-radius: var(--p-r-lg);
  overflow: hidden;
  border: 1px solid var(--p-line);
  background: var(--p-surface-2);
}
.edu-course-admin__placeholder {
  aspect-ratio: 21 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-ink-3);
}
.edu-course-admin__text {
  white-space: pre-wrap;
}
</style>
