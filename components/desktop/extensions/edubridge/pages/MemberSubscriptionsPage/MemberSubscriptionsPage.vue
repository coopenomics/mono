<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:member-subscriptions:banner-dismissed")
    | {{ $t('edubridge.memberSubscriptionsPage.hint.line1') }}

  //- Напоминание о продлении: взнос вносится заново на каждый период, и срок подходит.
  BaseBanner.q-mb-md(v-for="row in dueSoon" :key="asText(row.id)" variant="warn")
    template(#icon)
      q-icon(name="event_upcoming")
    | {{ $t('edubridge.memberSubscriptionsPage.renewNotice', { courseTitle: row.course_title, date: row.paid_until ? formatDate(row.paid_until) : '______' }) }}
    template(#action)
      BaseButton(variant="primary" size="sm" @click="extend(row)") {{ $t('edubridge.memberSubscriptionsPage.extend') }}

  ReturnToShareCard.q-mb-md(:key="walletRev")

  //- Подписки — реестр: базовая таблица из четырёх столбцов, которая помещается
  //- и при узком окне. Строка открывает правую панель; «Продлить» — в строке.
  BaseTable(
    v-if="firstLoad || enrollments.length"
    :columns="columns"
    :rows="enrollments"
    row-key="id"
    :loading="firstLoad"
    :clickable-rows="true"
    min-width="700px"
    @row-click="openDetails"
  )
    template(#cell-course_title="{ row }")
      .edu-subs__title {{ row.course_title }}
      .t-muted.t-sm {{ learnerName(row.learner_id) }} · {{ periodLabel(row.period) }}
      //- Пояснение к состоянию: ход заявления по гарантии либо основание возврата.
      .t-muted.t-sm(v-if="claimOf(row)") {{ $t('edubridge.guaranteeClaim.claimNumber', { number: claimOf(row)?.number }) }} · {{ $t(`edubridge.guaranteeClaim.status.${claimOf(row)?.status}`) }}
      .t-muted.t-sm(v-else-if="!isActive(row) && row.refund_reason") {{ refundReason(row.refund_reason) }}
    template(#cell-paid_until="{ row }")
      div {{ row.paid_until ? formatDate(row.paid_until) : '______' }}
      //- Сколько осталось — когда срок подходит: взнос вносится заново на каждый период.
      .edu-subs__due(v-if="isRenewSoon(row)") {{ $t('edubridge.memberSubscriptionsPage.daysLeft', { n: daysLeft(row.paid_until) }, Number(daysLeft(row.paid_until))) }}
    template(#cell-status="{ row }")
      .edu-subs__state
        BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
        BaseBadge(:variant="accessOf(row.access_state).variant") {{ accessOf(row.access_state).label }}
    //- «Продлить» нажимают каждый период — кнопка в строке; остальные действия — в панели.
    template(#cell-actions="{ row }")
      BaseButton(v-if="isActive(row)" variant="primary" size="sm" @click.stop="extend(row)") {{ $t('edubridge.memberSubscriptionsPage.extend') }}
  EmptyState(v-else :title="$t('edubridge.memberSubscriptionsPage.emptyTitle')" :body="$t('edubridge.memberSubscriptionsPage.emptyBody')")
    template(#icon)
      q-icon(name="school" size="32px")

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

  //- Подписка целиком: срок, состояние, гарантия; все действия — внизу панели.
  DetailsDrawer(v-model="detailsOpen" :title="details?.course_title || ''" :width="520")
    template(v-if="details")
      .edu-sub__badges
        BaseBadge(:variant="statusOf(details.status).variant") {{ statusOf(details.status).label }}
        BaseBadge(:variant="accessOf(details.access_state).variant") {{ accessOf(details.access_state).label }}
      DataRow(:label="$t('edubridge.memberSubscriptionsPage.details.learner')" :value="learnerName(details.learner_id)")
      DataRow(:label="$t('edubridge.memberSubscriptionsPage.details.period')" :value="periodLabel(details.period)")
      DataRow(:label="$t('edubridge.memberSubscriptionsPage.columns.paidUntil')" :value="details.paid_until ? formatDate(details.paid_until) : '______'" :hint="isRenewSoon(details) ? $t('edubridge.memberSubscriptionsPage.daysLeft', { n: daysLeft(details.paid_until) }, Number(daysLeft(details.paid_until))) : undefined")
      DataRow(v-if="!isActive(details) && details.refund_reason" :label="$t('edubridge.memberSubscriptionsPage.details.refund')" :value="refundReason(details.refund_reason)")
      template(v-if="guaranteeOf(details)")
        DataRow(v-if="claimOf(details)" :label="$t('edubridge.memberSubscriptionsPage.details.guaranteeClaim')" :value="`${$t('edubridge.guaranteeClaim.claimNumber', { number: claimOf(details)?.number })} · ${$t(`edubridge.guaranteeClaim.status.${claimOf(details)?.status}`)}`")
        DataRow(v-else-if="canClaimGuarantee(details) && guaranteeOf(details)?.guarantee_until" :label="$t('edubridge.memberSubscriptionsPage.details.guaranteeUntil')" :value="formatDate(guaranteeOf(details)?.guarantee_until)")
    template(v-if="details && isActive(details)" #footer)
      .edu-sub__footer
        //- Пока заявление по гарантии на рассмотрении совета, обычная отмена закрыта: возврат по подписке один.
        BaseButton(v-if="!underReview.has(asText(details.id))" variant="ghost" @click="openCancel(details)") {{ $t('edubridge.memberSubscriptionsPage.cancelSubscription') }}
        BaseButton(v-if="canClaimGuarantee(details)" variant="secondary" @click="openGuarantee(details)") {{ $t('edubridge.guaranteeClaim.open') }}
        q-space
        BaseButton(variant="primary" @click="extend(details)") {{ $t('edubridge.memberSubscriptionsPage.extend') }}

  GuaranteeClaimDialog(v-model="guaranteeOpen" :state="guaranteeTarget" @submitted="load")
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBanner, BaseBadge, BaseButton, BaseDialog, EmptyState, BaseTable, type BaseTableColumn, CardListSkeleton } from 'src/shared/ui/base';
import { DataRow, PageHint, DetailsDrawer } from 'src/shared/ui/domain';
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
import { GuaranteeClaimDialog, fetchMyGuarantees, type IGuaranteeState } from '../../features/Guarantee';
import { daysLeft, isRenewSoon } from '../../shared/lib/subscriptionDue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

/**
 * «Мои подписки»: что оплачено, до какого числа и в каком состоянии доступ.
 * Новая подписка оформляется в карточке курса, здесь — только продление
 * существующей: тот же диалог с закреплённым курсом.
 */
const learners = ref<ILearner[]>([]);
const enrollments = ref<IEnrollment[]>([]);
const courses = ref<ICatalogCourse[]>([]);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const extendOpen = ref(false);
const lockedCourseId = ref<string | null>(null);
const cancelOpen = ref(false);
const cancelTarget = ref<IEnrollment | null>(null);
const refund = ref<IRefundPreview | null>(null);
const cancelBusy = ref(false);
// Отмена и оплата меняют остаток кошелька программы — карточка перечитывает его.
const walletRev = ref(0);

// Идентификатор из API приходит скаляром без точного типа — сравниваем как текст.
const learnerName = (id: unknown) => learners.value.find((l) => asText(l.id) === asText(id))?.display_name ?? '______';
const periodLabel = (p: string) => PERIOD_LABELS[p] ?? p;
const statusOf = (s: string) => ENROLLMENT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const accessOf = (s: string) => ACCESS_STATE_LABELS[s] ?? { label: s, variant: 'neutral' as const };
// Дата из API приходит скаляром без точного типа — приводим к строке сами.
const formatDate = (v: unknown) => new Date(v instanceof Date ? v : String(v)).toLocaleDateString('ru-RU');
// Сетка таблицы: «Курс» без ширины получает остаток. Сумма заданных ширин —
// 460px при минимуме таблицы 700px, курсу остаётся не меньше 240px.
const columns: BaseTableColumn<IEnrollment>[] = [
  { key: 'course_title', label: t('edubridge.memberSubscriptionsPage.columns.course') },
  { key: 'paid_until', label: t('edubridge.memberSubscriptionsPage.columns.paidUntil'), width: '150px', nowrap: true },
  { key: 'status', label: t('edubridge.memberSubscriptionsPage.columns.status'), width: '180px', nowrap: true },
  { key: 'actions', label: '', align: 'right', width: '130px', nowrap: true },
];
const refundReason = (r: string) => REFUND_REASON_LABELS[r] ?? r;
/** Подписки, которые пора продлить: действуют, а оплаченный срок кончается в ближайшие дни. */
const dueSoon = computed(() => enrollments.value.filter((e) => isRenewSoon(e)));
/** Подписки, по которым заявление по гарантии рассматривает совет. */
const underReview = ref<Set<string>>(new Set());
/** Гарантийные условия по каждой подписке: срок, сумма, поданное заявление. */
const guarantees = ref<Map<string, IGuaranteeState>>(new Map());
const guaranteeOf = (row: IEnrollment) => guarantees.value.get(asText(row.id)) ?? null;
const claimOf = (row: IEnrollment) => guaranteeOf(row)?.claim ?? null;
/** Заявление по гарантии подаётся один раз, пока идёт гарантийный срок. */
const canClaimGuarantee = (row: IEnrollment) => Boolean(guaranteeOf(row)?.available) && !claimOf(row);
/** Подписка в правой панели — по идентификатору: после действия панель показывает свежее состояние. */
const detailsOpen = ref(false);
const detailsId = ref<string | null>(null);
const details = computed(() => enrollments.value.find((e) => asText(e.id) === detailsId.value) ?? null);
function openDetails(row: IEnrollment): void {
  detailsId.value = asText(row.id);
  detailsOpen.value = true;
}
const guaranteeOpen = ref(false);
const guaranteeTarget = ref<IGuaranteeState | null>(null);
function openGuarantee(row: IEnrollment): void {
  guaranteeTarget.value = guaranteeOf(row);
  guaranteeOpen.value = true;
}
const isActive = (row: IEnrollment) =>
  row.status === Zeus.EduEnrollmentStatus.ACTIVE || row.status === Zeus.EduEnrollmentStatus.PENDING;

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [l, e, c, g] = await Promise.all([
      fetchMyLearners(),
      fetchMyEnrollments(),
      fetchCatalog({ options: { page: 1, limit: 200, sortBy: 'sort_order', sortOrder: 'ASC' } }),
      fetchMyGuarantees(),
    ]);
    guarantees.value = new Map(g.map((x) => [asText(x.enrollment_id), x]));
    underReview.value = new Set(g.filter((x) => x.claim?.status === Zeus.EduGuaranteeClaimStatus.SUBMITTED).map((x) => asText(x.enrollment_id)));
    learners.value = l;
    enrollments.value = e;
    courses.value = c.items;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
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
useLiveReload([EduLive.enrollments, EduLive.learners, EduLive.courses, EduLive.guaranteeClaims], load);

onMounted(load);
</script>

<style scoped>
.edu-subs__title {
  font-weight: 600;
  color: var(--p-ink);
}
.edu-subs__due {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-warn);
}
.edu-subs__state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-1);
}
/* Панель подписки. */
.edu-sub__badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2);
  margin-bottom: var(--p-4);
}
.edu-sub__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-2);
}
</style>
