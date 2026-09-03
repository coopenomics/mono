<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:member-subscriptions:banner-dismissed")
    | Подписка открывается в каталоге: выберите курс и нажмите «Получить доступ». Членский взнос вносится
    | из паевого по заявлению о конвертации, доступ на площадке выдаётся автоматически. Здесь — что оплачено и до какого числа.

  BaseCard(variant="default" title="Мои подписки")
    BaseTable(v-if="loading || enrollments.length" :columns="columns" :rows="enrollments" row-key="id" :loading="loading && !enrollments.length" min-width="900px")
      template(#cell-learner="{ row }") {{ learnerName(row.learner_id) }}
      template(#cell-period="{ row }") {{ periodLabel(row.period) }}
      template(#cell-paid_until="{ row }") {{ row.paid_until ? formatDate(row.paid_until) : '______' }}
      template(#cell-status="{ row }")
        BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
      template(#cell-access_state="{ row }")
        BaseBadge(:variant="accessOf(row.access_state).variant") {{ accessOf(row.access_state).label }}
      template(#cell-actions="{ row }")
        BaseButton(variant="secondary" size="sm" @click="extend(row)") Продлить
    EmptyState(v-else title="Подписок пока нет" body="Выберите курс в каталоге и нажмите «Получить доступ».")
      template(#icon)
        q-icon(name="school" size="32px")
      template(#action)
        BaseButton.q-mt-md(variant="primary" @click="goToCatalog") Перейти в каталог

  SubscribeDialog(
    v-model="extendOpen"
    :learners="learners"
    :courses="courses"
    :locked-course-id="lockedCourseId"
    @learner-added="onLearnerAdded"
    @subscribed="onSubscribed"
  )
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { fetchCatalog, type ICatalogCourse } from '../../entities/Course';
import {
  ACCESS_STATE_LABELS,
  ENROLLMENT_STATUS_LABELS,
  PERIOD_LABELS,
  fetchMyEnrollments,
  fetchMyLearners,
  type IEnrollment,
  type ILearner,
} from '../../entities/Learner';
import { SubscribeDialog } from '../../features/Subscribe';

/**
 * «Мои подписки»: что оплачено, до какого числа и в каком состоянии доступ.
 * Новая подписка оформляется в карточке курса, здесь — только продление
 * существующей: тот же диалог с закреплённым курсом.
 */
const route = useRoute();
const router = useRouter();

const learners = ref<ILearner[]>([]);
const enrollments = ref<IEnrollment[]>([]);
const courses = ref<ICatalogCourse[]>([]);
const loading = ref(false);
const extendOpen = ref(false);
const lockedCourseId = ref<string | null>(null);

const columns: BaseTableColumn<IEnrollment>[] = [
  { key: 'course_title', label: 'Курс' },
  { key: 'learner', label: 'Обучающийся', width: '160px' },
  { key: 'period', label: 'Период', width: '100px' },
  { key: 'paid_until', label: 'Оплачено до', width: '130px' },
  { key: 'status', label: 'Подписка', width: '130px' },
  { key: 'access_state', label: 'Доступ', width: '150px' },
  { key: 'actions', label: '', align: 'right', width: '120px' },
];

const learnerName = (id: string) => learners.value.find((l) => l.id === id)?.display_name ?? '______';
const periodLabel = (p: string) => PERIOD_LABELS[p] ?? p;
const statusOf = (s: string) => ENROLLMENT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const accessOf = (s: string) => ACCESS_STATE_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const formatDate = (v: string | Date) => new Date(v).toLocaleDateString('ru-RU');

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [l, e, c] = await Promise.all([
      fetchMyLearners(),
      fetchMyEnrollments(),
      fetchCatalog({ options: { page: 1, limit: 200, sortBy: 'sort_order', sortOrder: 'ASC' } }),
    ]);
    learners.value = l;
    enrollments.value = e;
    courses.value = c.items;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function goToCatalog(): void {
  void router.push({ name: 'edubridge-catalog', params: { coopname: route.params.coopname } });
}

function extend(row: IEnrollment): void {
  lockedCourseId.value = row.course_id;
  extendOpen.value = true;
}
function onLearnerAdded(l: ILearner): void {
  const i = learners.value.findIndex((x) => x.id === l.id);
  if (i >= 0) learners.value[i] = l;
  else learners.value.push(l);
}
function onSubscribed(e: IEnrollment): void {
  const i = enrollments.value.findIndex((x) => x.id === e.id);
  if (i >= 0) enrollments.value[i] = e;
  else enrollments.value.push(e);
}

onMounted(load);
</script>
