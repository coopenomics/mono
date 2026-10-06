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

  BaseCard(variant="default" :title="$t('edubridge.memberSubscriptionsPage.title')")
    BaseTable(v-if="firstLoad || enrollments.length" :columns="columns" :rows="enrollments" row-key="id" :loading="firstLoad" min-width="880px")
      //- Под названием курса — пояснение к состоянию подписки: заявление по гарантии либо основание возврата.
      template(#cell-course_title="{ row }")
        div {{ row.course_title }}
        .t-meta.t-muted(v-if="isActive(row) && underReview.has(asText(row.id))") {{ $t('edubridge.memberSubscriptionsPage.guaranteeUnderReview') }}
        .t-meta.t-muted(v-else-if="!isActive(row) && row.refund_reason") {{ refundReason(row.refund_reason) }}
      template(#cell-learner="{ row }") {{ learnerName(row.learner_id) }}
      template(#cell-period="{ row }") {{ periodLabel(row.period) }}
      //- Под датой — сколько осталось, когда срок подходит: взнос вносится заново на каждый период.
      template(#cell-paid_until="{ row }")
        div {{ row.paid_until ? formatDate(row.paid_until) : '______' }}
        .edu-subs__due(v-if="isRenewSoon(row)") {{ $t('edubridge.memberSubscriptionsPage.daysLeft', { n: daysLeft(row.paid_until) }, Number(daysLeft(row.paid_until))) }}
      //- Состояние подписки и доступа — одним столбцом, значками друг под другом:
      //- так название курса получает свою ширину и не сжимается в столбик по буквам.
      template(#cell-status="{ row }")
        .edu-subs__state
          BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
          BaseBadge(:variant="accessOf(row.access_state).variant") {{ accessOf(row.access_state).label }}
      //- «Продлить» — главное действие строки и видна всегда; отмена нужна редко и
      //- лежит в меню. Так столбец остаётся узким и не уезжает за край при малой
      //- ширине окна и крупном масштабе. Меню — в слоте #menu кнопки-иконки.
      template(#cell-actions="{ row }")
        .edu-subs__actions(v-if="isActive(row)")
          BaseButton(variant="primary" size="sm" @click="extend(row)") {{ $t('edubridge.memberSubscriptionsPage.extend') }}
          //- Пока заявление по гарантии на рассмотрении совета, обычная отмена закрыта: возврат по подписке один.
          BaseButton(v-if="!underReview.has(asText(row.id))" variant="ghost" size="sm" icon-only :aria-label="$t('edubridge.memberSubscriptionsPage.actionsAriaLabel')")
            template(#icon-left)
              q-icon(name="more_horiz" size="20px")
            template(#menu)
              q-menu(anchor="bottom right" self="top right")
                q-list.edu-subs__menu(dense)
                  q-item(clickable v-close-popup @click="openCancel(row)")
                    q-item-section.text-negative {{ $t('edubridge.memberSubscriptionsPage.cancelSubscription') }}
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
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { asText } from 'src/shared/lib/utils';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBanner, BaseBadge, BaseButton, BaseCard, BaseDialog, BaseTable, CardListSkeleton, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
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
import { fetchMyGuarantees } from '../../features/Guarantee';
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

/**
 * Ширины: колонка курса единственная без фиксированной — она забирает остаток,
 * поэтому сумма фиксированных (710px) с запасом меньше min-width таблицы,
 * иначе курс схлопывается и длинное название наезжает на соседей.
 */
const columns: BaseTableColumn<IEnrollment>[] = [
  // Действия — первым столбцом: «Продлить» нажимают каждый период, и она видна при любой ширине окна.
  { key: 'actions', label: '', width: '150px', nowrap: true },
  { key: 'course_title', label: t('edubridge.memberSubscriptionsPage.columns.course') },
  // Таблица с фиксированной сеткой: «Курс» без ширины получает остаток. Сумма
  // заданных ширин — 680px при минимуме таблицы 880px, курсу остаётся не меньше 200px.
  { key: 'learner', label: t('edubridge.memberSubscriptionsPage.columns.learner'), width: '150px' },
  { key: 'period', label: t('edubridge.memberSubscriptionsPage.columns.period'), width: '110px', nowrap: true },
  { key: 'paid_until', label: t('edubridge.memberSubscriptionsPage.columns.paidUntil'), width: '120px', nowrap: true },
  { key: 'status', label: t('edubridge.memberSubscriptionsPage.columns.status'), width: '150px', nowrap: true },
  
];

const learnerName = (id: string) => learners.value.find((l) => l.id === id)?.display_name ?? '______';
const periodLabel = (p: string) => PERIOD_LABELS[p] ?? p;
const statusOf = (s: string) => ENROLLMENT_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const accessOf = (s: string) => ACCESS_STATE_LABELS[s] ?? { label: s, variant: 'neutral' as const };
// Дата из API приходит скаляром без точного типа — приводим к строке сами.
const formatDate = (v: unknown) => new Date(v instanceof Date ? v : String(v)).toLocaleDateString('ru-RU');
const refundReason = (r: string) => REFUND_REASON_LABELS[r] ?? r;
/** Подписки, которые пора продлить: действуют, а оплаченный срок кончается в ближайшие дни. */
const dueSoon = computed(() => enrollments.value.filter((e) => isRenewSoon(e)));
/** Подписки, по которым заявление по гарантии рассматривает совет. */
const underReview = ref<Set<string>>(new Set());
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
.edu-subs__state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-1);
}
.edu-subs__actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  gap: var(--p-1);
}
.edu-subs__due {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-warn);
  white-space: nowrap;
}
.edu-subs__menu {
  min-width: 200px;
}
</style>
