<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:member-subscriptions:banner-dismissed")
    | Подписка открывается в каталоге: выберите курс и нажмите «Получить доступ». Членский взнос вносится
    | из паевого по заявлению о конвертации, доступ на площадке выдаётся автоматически. Здесь — что оплачено и до какого числа.

  BaseCard(variant="default" title="Мои подписки")
    BaseTable(v-if="loading || enrollments.length" :columns="columns" :rows="enrollments" row-key="id" :loading="firstLoad" min-width="820px")
      template(#cell-learner="{ row }") {{ learnerName(row.learner_id) }}
      template(#cell-period="{ row }") {{ periodLabel(row.period) }}
      template(#cell-paid_until="{ row }") {{ row.paid_until ? formatDate(row.paid_until) : '______' }}
      template(#cell-status="{ row }")
        BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
      template(#cell-access_state="{ row }")
        BaseBadge(:variant="accessOf(row.access_state).variant") {{ accessOf(row.access_state).label }}
      template(#cell-actions="{ row }")
        .row.no-wrap.justify-end.q-gutter-xs
          BaseButton(v-if="isActive(row)" variant="secondary" size="sm" @click="extend(row)") Продлить
          BaseButton(v-if="isActive(row)" variant="ghost" size="sm" @click="openCancel(row)") Отменить
          .t-meta.t-muted(v-else-if="row.refund_reason") {{ refundReason(row.refund_reason) }}
    EmptyState(v-else title="Подписок пока нет" body="Выберите курс в каталоге и нажмите «Получить доступ».")
      template(#icon)
        q-icon(name="school" size="32px")
      template(#action)
        BaseButton.q-mt-md(variant="primary" @click="goToCatalog") Перейти в каталог

  //- Отмена подписки: сумма возврата считается по Положению ЦПП на сервере,
  //- поэтому ученик видит её до нажатия, а не после.
  BaseDialog(v-model="cancelOpen" title="Отменить подписку" size="sm")
    .t-sm.t-muted.q-mb-md(v-if="cancelTarget") {{ cancelTarget.course_title }}
    CardListSkeleton(v-if="!refund" :count="1")
    template(v-else)
      DataRow(label="Уплачено" :value="formatAsset2Digits(cancelTarget?.paid_amount ?? '')")
      DataRow(label="Занятий прошло" :value="`${refund.lessons_used} из ${refund.lessons_paid}`")
      DataRow(label="Вернётся" :value="formatAsset2Digits(refund.refund)")
      DataRow(label="Останется программе" :value="formatAsset2Digits(refund.withheld)")
      .t-sm.t-muted.q-mt-sm {{ refundReason(refund.reason) }}
    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant="ghost" :disabled="cancelBusy" @click="cancelOpen = false") Закрыть
      BaseButton(variant="danger" :loading="cancelBusy" :disabled="!refund" @click="confirmCancel") Отменить подписку

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
import { Zeus } from '@coopenomics/sdk';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseTable, CardListSkeleton, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, PageHint } from 'src/shared/ui/domain';
import { fetchCatalog, type ICatalogCourse } from '../../entities/Course';
import {
  ACCESS_STATE_LABELS,
  ENROLLMENT_STATUS_LABELS,
  PERIOD_LABELS,
  REFUND_REASON_LABELS,
  cancelEnrollment,
  fetchMyEnrollments,
  fetchMyLearners,
  fetchRefundPreview,
  type IEnrollment,
  type ILearner,
  type IRefundPreview,
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
const firstLoad = useFirstLoad(loading);
const extendOpen = ref(false);
const lockedCourseId = ref<string | null>(null);
const cancelOpen = ref(false);
const cancelTarget = ref<IEnrollment | null>(null);
const refund = ref<IRefundPreview | null>(null);
const cancelBusy = ref(false);

/**
 * Ширины: колонка курса единственная без фиксированной — она забирает остаток,
 * поэтому сумма фиксированных (710px) с запасом меньше min-width таблицы,
 * иначе курс схлопывается и длинное название наезжает на соседей.
 */
const columns: BaseTableColumn<IEnrollment>[] = [
  { key: 'course_title', label: 'Курс' },
  { key: 'learner', label: 'Обучающийся', width: '140px' },
  { key: 'period', label: 'Период', width: '90px', nowrap: true },
  { key: 'paid_until', label: 'Оплачено до', width: '120px', nowrap: true },
  { key: 'status', label: 'Подписка', width: '120px', nowrap: true },
  { key: 'access_state', label: 'Доступ', width: '130px', nowrap: true },
  { key: 'actions', label: '', align: 'right', width: '110px' },
];

const learnerName = (id: string) => learners.value.find((l) => l.id === id)?.display_name ?? '______';
const periodLabel = (p: string) => PERIOD_LABELS[p] ?? p;
const statusOf = (s: string) => ENROLLMENT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const accessOf = (s: string) => ACCESS_STATE_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const formatDate = (v: string | Date) => new Date(v).toLocaleDateString('ru-RU');
const refundReason = (r: string) => REFUND_REASON_LABELS[r] ?? r;
const isActive = (row: IEnrollment) =>
  row.status === Zeus.EduEnrollmentStatus.ACTIVE || row.status === Zeus.EduEnrollmentStatus.PENDING;

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
  lockedCourseId.value = asText(row.course_id);
  extendOpen.value = true;
}
async function openCancel(row: IEnrollment): Promise<void> {
  cancelTarget.value = row;
  refund.value = null;
  cancelOpen.value = true;
  try {
    refund.value = await fetchRefundPreview(asText(row.id));
  } catch (e) {
    FailAlert(e);
    cancelOpen.value = false;
  }
}

async function confirmCancel(): Promise<void> {
  if (!cancelTarget.value) return;
  cancelBusy.value = true;
  try {
    const updated = await cancelEnrollment(asText(cancelTarget.value.id));
    enrollments.value = enrollments.value.map((e) => (e.id === updated.id ? updated : e));
    cancelOpen.value = false;
    SuccessAlert(`Подписка отменена, возврат ${formatAsset2Digits(updated.refunded_amount ?? '')}`);
  } catch (e) {
    FailAlert(e);
  } finally {
    cancelBusy.value = false;
  }
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
