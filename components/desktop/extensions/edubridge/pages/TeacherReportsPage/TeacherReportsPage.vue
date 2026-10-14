<template lang="pug">
.q-pa-md
  //- Отчёты одной таблицей: занятие без отчёта — строкой с кнопкой отчёта; отчитанное —
  //- строкой взноса со всеми занятиями, за которые он заведён (за гарантийный срок — на
  //- несколько занятий сразу). У каждой строки сумма взноса и своё действие. Строка
  //- открывает правую панель; материалы и длительность каждого занятия — в ней.
  BaseCard(variant="default" :title="$t('edubridge.teacherReportsPage.title')")
    template(v-if="actionsCount" #actions)
      BaseBadge(variant="warn") {{ actionsCount }}
    BaseTable(
      v-if="firstLoad || rows.length"
      :columns="columns"
      :rows="rows"
      row-key="id"
      :loading="firstLoad"
      :clickable-rows="true"
      min-width="1100px"
      @row-click="openDetails"
    )
      template(#cell-lesson_number="{ row }") {{ lessonNumbersOf(row) }}
      template(#cell-lesson="{ row }")
        .edu-lessons__title {{ titleOf(row) }}
        .t-muted.t-sm {{ row.course_title }}
      template(#cell-held_at="{ row }") {{ heldRangeOf(row) }}
      template(#cell-amount="{ row }")
        span.t-num(v-if="row.contribution") {{ formatAsset2Digits(row.contribution.amount) }}
        //- До взноса — расчёт по ставке допуска, окну и обучающимся; окончательную сумму считает контракт.
        template(v-else-if="expectedOf(row)")
          span.t-num {{ formatAsset2Digits(expectedOf(row)) }}
          .t-muted.t-sm {{ $t('edubridge.teacherReportsPage.expectedLine') }}
        span(v-else) ______
        //- Срез курса на дату занятия: по скольким участникам контракт провёл расчёт.
        .t-muted.t-sm(v-if="row.learners_count") {{ $t('edubridge.teacherLessonsPage.learnersLine', { count: row.learners_count }) }}
      template(#cell-status="{ row }")
        BaseBadge(v-if="row.awaiting" :variant="row.overdue ? 'neg' : 'warn'") {{ $t(row.overdue ? 'edubridge.teacherReportsPage.overdue' : 'edubridge.teacherReportsPage.awaiting') }}
        BaseBadge(v-else-if="row.contribution" :variant="statusOf(row.contribution.status).variant") {{ statusOf(row.contribution.status).label }}
        BaseBadge(v-else-if="row.learners_count" variant="info") {{ $t('edubridge.teacherLessonsPage.statusInGuarantee') }}
        template(v-else) ______
      //- Действие за преподавателем — своей колонкой справа; нажатие строку не открывает.
      template(#cell-actions="{ row }")
        BaseButton(v-if="actionOf(row) === 'report'" variant="primary" size="sm" @click.stop="reportTarget = row") {{ $t('edubridge.teacherLessonsPage.reportButton') }}
        BaseButton(v-else-if="actionOf(row) === 'transfer'" variant="primary" size="sm" :loading="rowBusy === asText(row.id)" @click.stop="onTransfer(row)") {{ $t('edubridge.teacherLessonsPage.transferMaterials') }}
        BaseButton(v-else-if="actionOf(row) === 'sign'" variant="primary" size="sm" :loading="rowBusy === asText(row.id)" @click.stop="onSignAct(row)") {{ $t('edubridge.teacherLessonsPage.signAct') }}
    EmptyState(v-if="!firstLoad && !rows.length" :title="$t('edubridge.teacherLessonsPage.emptyTitle')" :body="$t('edubridge.teacherLessonsPage.emptyBody')")
      template(#icon)
        q-icon(name="event_available" size="32px")

  //- Взнос целиком: состояние и сумма, затем каждое занятие с датой, длительностью и материалами; действие преподавателя — внизу панели.
  DetailsDrawer(v-model="detailsOpen" :title="details ? titleOf(details) : ''" :width="560")
    template(v-if="details")
      BaseBadge.q-mb-md(v-if="details.contribution" :variant="statusOf(details.contribution.status).variant") {{ statusOf(details.contribution.status).label }}
      DataRow(:label="$t('edubridge.teacherLessonsPage.details.course')" :value="details.course_title")
      DataRow(:label="$t('edubridge.teacherLessonsPage.details.number')" :value="lessonNumbersOf(details)")
      DataRow(v-if="details.learners_count" :label="$t('edubridge.teacherLessonsPage.details.learners')" :value="String(details.learners_count)")
      DataRow(v-if="!details.contribution && expectedOf(details)" :label="$t('edubridge.teacherLessonsPage.details.amount')" :value="formatAsset2Digits(expectedOf(details))" :hint="$t('edubridge.teacherReportsPage.expectedHint')")
      template(v-if="details.contribution")
        DataRow(:label="$t('edubridge.teacherLessonsPage.details.amount')" :value="formatAsset2Digits(details.contribution.amount)")
        DataRow(v-if="details.contribution.hold_until" :label="$t('edubridge.teacherLessonsPage.details.holdUntil')" :value="formatDate(details.contribution.hold_until)")
        DataRow(v-if="details.contribution.decline_reason" :label="$t('edubridge.teacherLessonsPage.details.declineReason')" :value="details.contribution.decline_reason")
      .edu-lesson__section(v-for="l in details.lessons" :key="asText(l.id)")
        .t-eyebrow.q-mb-sm {{ $t('edubridge.teacherLessonsPage.lessonTitle', { number: l.lesson_number }) }}
        DataRow(v-if="l.topic" :label="$t('edubridge.teacherLessonsPage.details.topic')" :value="l.topic")
        DataRow(:label="$t('edubridge.teacherLessonsPage.details.heldAt')" :value="formatLessonMoment(l.held_at)")
        DataRow(:label="$t('edubridge.teacherLessonsPage.details.duration')" :value="$t('edubridge.teacherLessonsPage.durationMinutes', { minutes: l.duration_minutes })")
        .t-muted.t-sm.q-mt-sm {{ $t('edubridge.teacherLessonsPage.details.materials') }}
        .edu-lesson__files(v-if="l.materials.length")
          a.edu-lesson__link(v-for="link in l.materials" :key="link" :href="link" target="_blank" rel="noopener")
            q-icon(name="link" size="14px")
            span {{ link }}
        .t-muted.t-sm(v-else) ______
    template(v-if="detailsAction" #footer)
      .row.justify-end
        BaseButton(v-if="detailsAction === 'report'" variant="primary" @click="details && openReportFromDetails(details)") {{ $t('edubridge.teacherLessonsPage.reportButton') }}
        BaseButton(v-else-if="detailsAction === 'transfer'" variant="primary" :loading="rowBusy === asText(details?.id)" @click="details && onTransfer(details)") {{ $t('edubridge.teacherLessonsPage.transferMaterials') }}
        BaseButton(v-else variant="primary" :loading="rowBusy === asText(details?.id)" @click="details && onSignAct(details)") {{ $t('edubridge.teacherLessonsPage.signAct') }}

  LessonReportDialog(:lesson="reportTarget" @close="reportTarget = null" @busy="reporting = $event" @done="load")
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asText } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, EmptyState, BaseTable, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer } from 'src/shared/ui/domain';
import { CONTRIBUTION_STATUS_LABELS, commitLessonMaterials, signAct, type IContribution, type ILesson } from '../../entities/Teacher';
import { formatLessonMoment } from '../../entities/Lesson';
import { useTeacherLessons } from '../../features/TeacherLessons';
import { LessonReportDialog } from '../../widgets/LessonReportDialog';
import { lessonActionOf, type LessonAction } from '../../shared/lib/lessonAction';
import { t } from '../../i18n';

/**
 * Отчёты преподавателя: занятия без отчёта, документы на подпись и журнал
 * взносов. Отчёт по занятию — это и есть взнос результатом работы: сумму
 * считает контракт, а материалы уходят кооперативу на ответственное хранение
 * тем же действием. Состояние взноса видно в журнале; после решения совета
 * здесь же подписывается акт приёма-передачи.
 */
// realtime: живое обновление занятий и взносов — в useTeacherLessons
const { lessons, firstLoad, reporting, load, awaitingReport, contributionOf, replaceContribution } = useTeacherLessons();
const rowBusy = ref<string | null>(null);
const reportTarget = ref<ILesson | null>(null);

/** Проведённые занятия — журнал; запланированные живут в календаре. */
const heldLessons = computed(() => lessons.value.filter((l) => l.status === Zeus.EduLessonStatus.HELD));
/**
 * Строка журнала: взнос вместе с занятиями, за которые он заведён. Взнос за
 * гарантийный срок один на все занятия периода — документы по нему подписываются
 * один раз, и в журнале он одна запись. Поля занятия в строке — от первого по номеру.
 */
type ILessonRow = ILesson & { contribution: IContribution | null; lessons: ILesson[]; awaiting: boolean };
/** Что сейчас за преподавателем по строке: отчитаться, передать материалы либо подписать акт. */
type RowAction = 'report' | LessonAction;

const columns: BaseTableColumn<ILessonRow>[] = [
  { key: 'lesson_number', label: t('edubridge.teacherLessonsPage.column.number'), width: '80px', nowrap: true },
  { key: 'lesson', label: t('edubridge.teacherLessonsPage.column.lesson') },
  { key: 'held_at', label: t('edubridge.teacherLessonsPage.column.heldAt'), width: '220px', nowrap: true },
  { key: 'amount', label: t('edubridge.teacherLessonsPage.column.amount'), numeric: true, width: '180px', nowrap: true },
  { key: 'status', label: t('edubridge.teacherLessonsPage.column.status'), width: '260px', nowrap: true },
  { key: 'actions', label: '', align: 'right', width: '180px', nowrap: true },
];

const statusOf = (s: string) => CONTRIBUTION_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
/** Действие, которое сейчас за преподавателем по занятию: передать материалы либо подписать акт. */
const actionOf = (row: ILessonRow): RowAction | null => (row.awaiting ? 'report' : lessonActionOf(row.contribution?.status));
const byNumber = (a: ILesson, b: ILesson) => Number(a.lesson_number) - Number(b.lesson_number);
/** Занятия одного взноса — одной записью; занятие без взноса — записью само по себе. */
function packLessons(all: ILesson[]): ILesson[][] {
  const packs = new Map<string, ILesson[]>();
  for (const l of all) {
    const key = l.contribution_id ? `c:${asText(l.contribution_id)}` : `l:${asText(l.id)}`;
    packs.set(key, [...(packs.get(key) ?? []), l]);
  }
  return [...packs.values()].map((pack) => pack.sort(byNumber));
}
const lastOf = (row: ILessonRow): ILesson => row.lessons[row.lessons.length - 1];
/** Отчитанные занятия — строками взносов; занятия без отчёта — строкой каждое. */
const journalRows = computed<ILessonRow[]>(() =>
  packLessons(heldLessons.value).map((pack) => ({ ...pack[0], lessons: pack, contribution: contributionOf(pack[0]), awaiting: false })),
);
const awaitingRows = computed<ILessonRow[]>(() => awaitingReport.value.map((l) => ({ ...l, lessons: [l], contribution: null, awaiting: true })));
// Сверху строки, где ход за преподавателем; внутри групп — свежие занятия выше, при одной дате — по номеру.
const byFreshness = (a: ILessonRow, b: ILessonRow) => String(lastOf(b).held_at).localeCompare(String(lastOf(a).held_at)) || byNumber(b, a);
const rows = computed<ILessonRow[]>(() => {
  const all = [...awaitingRows.value, ...journalRows.value];
  return [...all.filter((r) => actionOf(r)).sort(byFreshness), ...all.filter((r) => !actionOf(r)).sort(byFreshness)];
});
/** Дел за преподавателем — число на заголовке таблицы. */
const actionsCount = computed(() => rows.value.filter((r) => actionOf(r)).length);
/** Сумма взноса до расчёта — показ сервера по занятию строки; окончательную сумму считает контракт. */
const expectedOf = (row: ILessonRow): string => String(row.expected_amount ?? '');
const lessonNumbersOf = (row: ILessonRow): string => row.lessons.map((l) => l.lesson_number).join(', ');
/** Заголовок записи — номер занятия; у взноса на несколько занятий — их номера. Тема — в панели. */
const titleOf = (row: ILessonRow): string =>
  row.lessons.length > 1 ? t('edubridge.teacherLessonsPage.packTitle', { lessons: lessonNumbersOf(row) }) : t('edubridge.teacherLessonsPage.lessonTitle', { number: row.lesson_number });
/** Даты занятий записи: одна либо «первая – последняя». */
function heldRangeOf(row: ILessonRow): string {
  const first = formatDate(row.held_at);
  const last = formatDate(lastOf(row).held_at);
  return first === last ? first : `${first} – ${last}`;
}

/** Взнос в правой панели — по идентификатору: панель показывает свежее состояние после действия и обновления журнала. */
const detailsOpen = ref(false);
const detailsId = ref<string | null>(null);
const details = computed(() => rows.value.find((r) => asText(r.id) === detailsId.value) ?? null);
/** Действие, которое сейчас за преподавателем по этому занятию. */
const detailsAction = computed<RowAction | null>(() => (details.value ? actionOf(details.value) : null));
function openReportFromDetails(row: ILessonRow): void {
  detailsOpen.value = false;
  reportTarget.value = row;
}
function openDetails(row: ILessonRow): void {
  detailsId.value = asText(row.id);
  detailsOpen.value = true;
}


const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('ru-RU') : '______');

async function onTransfer(lesson: ILesson): Promise<void> {
  const c = contributionOf(lesson);
  if (!c) return;
  rowBusy.value = asText(lesson.id);
  try {
    replaceContribution(await commitLessonMaterials(c));
    SuccessAlert(t('edubridge.teacherLessonsPage.documentsSigned'));
  } catch (e) {
    FailAlert(e);
  } finally {
    rowBusy.value = null;
  }
}

async function onSignAct(lesson: ILesson): Promise<void> {
  const c = contributionOf(lesson);
  if (!c) return;
  rowBusy.value = asText(lesson.id);
  try {
    replaceContribution(await signAct(c));
    SuccessAlert(t('edubridge.teacherLessonsPage.actSignedSuccess'));
  } catch (e) {
    FailAlert(e);
  } finally {
    rowBusy.value = null;
  }
}

</script>

<style scoped>
.edu-lessons__title {
  font-weight: 600;
  color: var(--p-ink);
}
/* Панель занятия: материалы отдельным блоком под сведениями. */
.edu-lesson__section {
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.edu-lesson__files {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
.edu-lesson__link {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  font-size: var(--p-fs-body-sm);
  color: var(--p-primary);
  text-decoration: none;
  overflow-wrap: anywhere;
}
.edu-lesson__link:hover {
  text-decoration: underline;
}
</style>
