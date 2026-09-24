<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:member-subscriptions:banner-dismissed")
    | {{ $t('edubridge.memberSubscriptionsPage.hint.line1') }}
    | {{ $t('edubridge.memberSubscriptionsPage.hint.line2') }}
    | {{ $t('edubridge.memberSubscriptionsPage.hint.line3') }}
    | {{ $t('edubridge.memberSubscriptionsPage.hint.line4') }}
    | {{ $t('edubridge.memberSubscriptionsPage.hint.line5') }}
    |#[a.edu-subscriptions__link(href="#" @click.prevent="goToPrograms") {{ $t('edubridge.memberSubscriptionsPage.hint.programsLink') }}].

  BaseCard(variant="default" :title="$t('edubridge.memberSubscriptionsPage.title')")
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
          BaseButton(v-if="isActive(row)" variant="secondary" size="sm" @click="extend(row)") {{ $t('edubridge.memberSubscriptionsPage.extend') }}
          BaseButton(v-if="isActive(row)" variant="ghost" size="sm" @click="openCancel(row)") {{ $t('edubridge.memberSubscriptionsPage.cancel') }}
          .t-meta.t-muted(v-else-if="row.refund_reason") {{ refundReason(row.refund_reason) }}
    EmptyState(v-else :title="$t('edubridge.memberSubscriptionsPage.emptyTitle')" :body="$t('edubridge.memberSubscriptionsPage.emptyBody')")
      template(#icon)
        q-icon(name="school" size="32px")
      template(#action)
        BaseButton.q-mt-md(variant="primary" @click="goToCatalog") {{ $t('edubridge.memberSubscriptionsPage.goToCatalog') }}

  ReturnToShareCard.q-mt-md(:key="walletRev")

  //- Отмена подписки: сумма возврата считается по Положению ЦПП на сервере,
  //- поэтому ученик видит её до нажатия, а не после.
  BaseDialog(v-model="cancelOpen" :title="$t('edubridge.memberSubscriptionsPage.cancelSubscription')" size="sm")
    .t-sm.t-muted.q-mb-md(v-if="cancelTarget") {{ cancelTarget.course_title }}
    CardListSkeleton(v-if="!refund" :count="1")
    template(v-else)
      DataRow(:label="$t('edubridge.memberSubscriptionsPage.cancelDialog.paidLabel')" :value="formatAsset2Digits(cancelTarget?.paid_amount ?? '')")
      DataRow(:label="$t('edubridge.memberSubscriptionsPage.cancelDialog.lessonsUsedLabel')" :value="$t(`edubridge.memberSubscriptionsPage.cancelDialog.lessonsUsedValue`, { lessonsUsed: refund.lessons_used, lessonsPaid: refund.lessons_paid })")
      DataRow(:label="$t('edubridge.memberSubscriptionsPage.cancelDialog.refundLabel')" :value="formatAsset2Digits(refund.refund)")
      DataRow(:label="$t('edubridge.memberSubscriptionsPage.cancelDialog.withheldLabel')" :value="formatAsset2Digits(refund.withheld)")
      .t-sm.t-muted.q-mt-sm {{ refundReason(refund.reason) }}
    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant="ghost" :disabled="cancelBusy" @click="cancelOpen = false") {{ $t('common.action.close') }}
      BaseButton(variant="danger" :loading="cancelBusy" :disabled="!refund" @click="confirmCancel") {{ $t('edubridge.memberSubscriptionsPage.cancelSubscription') }}

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
import { ReturnToShareCard } from '../../features/ReturnToShare';
import { SubscribeDialog } from '../../features/Subscribe';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

/**
 * «Мои подписки»: что оплачено, до какого числа и в каком состоянии доступ.
 * Новая подписка оформляется в карточке курса, здесь — только продление
 * существующей: тот же диалог с закреплённым курсом.
 */
const route = useRoute();

const router = useRouter();
/** Путь к деньгам: остатки кошельков программ возвращаются при выходе из кооператива. */
function goToPrograms(): void {
  void router.push({ name: 'user-programs', params: { coopname: route.params.coopname } });
}


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
// Отмена и оплата меняют остаток кошелька программы — карточка перечитывает его.
const walletRev = ref(0);

/**
 * Ширины: колонка курса единственная без фиксированной — она забирает остаток,
 * поэтому сумма фиксированных (710px) с запасом меньше min-width таблицы,
 * иначе курс схлопывается и длинное название наезжает на соседей.
 */
const columns: BaseTableColumn<IEnrollment>[] = [
  { key: 'course_title', label: t('edubridge.memberSubscriptionsPage.columns.course') },
  { key: 'learner', label: t('edubridge.memberSubscriptionsPage.columns.learner'), width: '140px' },
  { key: 'period', label: t('edubridge.memberSubscriptionsPage.columns.period'), width: '90px', nowrap: true },
  { key: 'paid_until', label: t('edubridge.memberSubscriptionsPage.columns.paidUntil'), width: '120px', nowrap: true },
  { key: 'status', label: t('edubridge.memberSubscriptionsPage.columns.status'), width: '120px', nowrap: true },
  { key: 'access_state', label: t('edubridge.memberSubscriptionsPage.columns.accessState'), width: '130px', nowrap: true },
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
    walletRev.value += 1;
    SuccessAlert(t('edubridge.memberSubscriptionsPage.cancelSuccess', { refundAmount: formatAsset2Digits(updated.refunded_amount ?? '') }));
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
  walletRev.value += 1;
  const i = enrollments.value.findIndex((x) => x.id === e.id);
  if (i >= 0) enrollments.value[i] = e;
  else enrollments.value.push(e);
}

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.enrollments, EduLive.learners, EduLive.courses, EduLive.returnRequests], load);

onMounted(load);
</script>

<style scoped>
.edu-subscriptions__link {
  color: var(--p-primary);
  cursor: pointer;
}
</style>
