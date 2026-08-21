<template lang="pug">
.q-pa-md
  PageHint(storage-key="edu:member-learners:banner-dismissed")
    | Добавьте обучающихся — себя или детей, каждого со своим адресом, — затем выберите курс и период.
    | Членский взнос вносится из паевого взноса по заявлению о конвертации; доступ на площадке выдаётся автоматически.

  .row.q-col-gutter-md
    .col-12.col-lg-4
      BaseCard(variant="default" title="Обучающиеся")
        CardListSkeleton(v-if="loadingLearners && !learners.length" :count="2")
        EmptyState(v-else-if="!learners.length" title="Обучающихся пока нет" body="Добавьте первого обучающегося.")
          template(#icon)
            q-icon(name="family_restroom" size="32px")
        q-list(v-else separator)
          q-item(v-for="l in learners" :key="l.id")
            q-item-section
              .text-weight-medium {{ l.display_name }}
                BaseChip.q-ml-sm(v-if="l.is_self" variant="neutral" size="sm") я
              .t-muted.t-sm.t-mono {{ l.recipient_value }}
            q-item-section(side)
              BaseButton(variant="ghost" size="sm" icon-only aria-label="Изменить" @click="editLearner(l)")
                template(#icon-left)
                  q-icon(name="edit" size="18px")
        .q-mt-md
          BaseButton(variant="secondary" block @click="addLearnerOpen()") Добавить обучающегося

    .col-12.col-lg-8
      BaseCard(variant="default" title="Подписки и доступ")
        BaseTable(:columns="columns" :rows="enrollments" row-key="id" :loading="loadingEnrollments && !enrollments.length" min-width="640px")
          template(#cell-learner="{ row }") {{ learnerName(row.learner_id) }}
          template(#cell-period="{ row }") {{ periodLabel(row.period) }}
          template(#cell-paid_until="{ row }") {{ row.paid_until ? formatDate(row.paid_until) : '—' }}
          template(#cell-status="{ row }")
            BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
          template(#cell-access_state="{ row }")
            BaseBadge(:variant="accessOf(row.access_state).variant") {{ accessOf(row.access_state).label }}
          template(#cell-actions="{ row }")
            BaseButton(variant="secondary" size="sm" @click="extend(row)") Продлить
        EmptyState(v-if="!loadingEnrollments && !enrollments.length" title="Подписок пока нет" body="Нажмите «Получить доступ», чтобы выбрать курс.")
          template(#icon)
            q-icon(name="school" size="32px")

  BaseDialog(v-model="learnerDialogOpen" :title="editingLearner ? 'Изменить обучающегося' : 'Новый обучающийся'" size="md")
    LearnerForm(:learner="editingLearner" @saved="onLearnerSaved" @cancel="learnerDialogOpen = false")

  SubscribeDialog(
    v-model="subscribeOpen"
    :learners="learners"
    :courses="courses"
    :locked-course-id="lockedCourseId"
    @subscribed="onSubscribed"
  )
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { BaseBadge, BaseButton, BaseCard, BaseChip, BaseDialog, BaseTable, CardListSkeleton, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
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
import { LearnerForm } from '../../widgets/LearnerForm';
import GetAccessHeaderButton from './GetAccessHeaderButton.vue';

/** Стол пайщика-родителя: обучающиеся, подписки, состояние доступа и срок по каждой связке. */
const route = useRoute();
const { registerAction } = useHeaderActions();

const learners = ref<ILearner[]>([]);
const enrollments = ref<IEnrollment[]>([]);
const courses = ref<ICatalogCourse[]>([]);
const loadingLearners = ref(false);
const loadingEnrollments = ref(false);

const learnerDialogOpen = ref(false);
const editingLearner = ref<ILearner | null>(null);
const subscribeOpen = ref(false);
const lockedCourseId = ref<string | null>((route.query.course as string) || null);

const columns: BaseTableColumn<IEnrollment>[] = [
  { key: 'course_title', label: 'Курс' },
  { key: 'learner', label: 'Обучающийся', width: '160px' },
  { key: 'period', label: 'Период', width: '100px' },
  { key: 'paid_until', label: 'Оплачено до', width: '130px' },
  { key: 'status', label: 'Подписка', width: '130px' },
  { key: 'access_state', label: 'Доступ', width: '150px' },
  { key: 'actions', label: '', align: 'right', width: '120px' },
];

const learnerName = (id: string) => learners.value.find((l) => l.id === id)?.display_name ?? '—';
const periodLabel = (p: string) => PERIOD_LABELS[p] ?? p;
const statusOf = (s: string) => ENROLLMENT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const accessOf = (s: string) => ACCESS_STATE_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const formatDate = (v: string | Date) => new Date(v).toLocaleDateString('ru-RU');

async function load(): Promise<void> {
  loadingLearners.value = true;
  loadingEnrollments.value = true;
  try {
    const [l, e, c] = await Promise.all([fetchMyLearners(), fetchMyEnrollments(), fetchCatalog({ options: { page: 1, limit: 200, sortBy: 'sort_order', sortOrder: 'ASC' } })]);
    learners.value = l;
    enrollments.value = e;
    courses.value = c.items;
  } catch (e) {
    FailAlert(e);
  } finally {
    loadingLearners.value = false;
    loadingEnrollments.value = false;
  }
}

function addLearnerOpen(): void {
  editingLearner.value = null;
  learnerDialogOpen.value = true;
}
function editLearner(l: ILearner): void {
  editingLearner.value = l;
  learnerDialogOpen.value = true;
}
function onLearnerSaved(l: ILearner): void {
  const i = learners.value.findIndex((x) => x.id === l.id);
  if (i >= 0) learners.value[i] = l;
  else learners.value.push(l);
  learnerDialogOpen.value = false;
}

function getAccess(): void {
  if (!learners.value.length) {
    addLearnerOpen();
    return;
  }
  subscribeOpen.value = true;
}
function extend(row: IEnrollment): void {
  lockedCourseId.value = row.course_id;
  subscribeOpen.value = true;
}
function onSubscribed(e: IEnrollment): void {
  const i = enrollments.value.findIndex((x) => x.id === e.id);
  if (i >= 0) enrollments.value[i] = e;
  else enrollments.value.push(e);
}

onMounted(async () => {
  registerAction({ id: 'edubridge:get-access', component: GetAccessHeaderButton, props: { onClick: getAccess } });
  await load();
  if (lockedCourseId.value) subscribeOpen.value = true;
});
</script>
