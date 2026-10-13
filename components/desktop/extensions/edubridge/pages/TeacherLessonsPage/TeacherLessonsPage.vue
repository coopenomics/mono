<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-lessons:banner-dismissed")
    | {{ $t('edubridge.teacherLessonsPage.hintCalendar') }}

  //- Занятия, по которым отчёт открыт прямо сейчас. Показаны ближайшие три: остальные — строкой,
  //- они открываются из календаря ниже. Иначе баннеры занимают экран и календарь уезжает вниз.
  BaseBanner.q-mb-md(v-for="l in awaitingShown" :key="asText(l.id)" variant="warn")
    template(#icon)
      q-icon(name="event_available")
    | {{ $t(l.overdue ? 'edubridge.teacherLessonsPage.awaitingReportOverdue' : 'edubridge.teacherLessonsPage.awaitingReport', { number: l.lesson_number, courseTitle: l.course_title, groupTitle: l.group_title, moment: formatLessonMoment(l.held_at) }) }}
    template(#action)
      BaseButton(variant="primary" size="sm" @click="openReport(l)") {{ $t('edubridge.teacherLessonsPage.reportButton') }}
  .t-sm.t-muted.q-mb-md(v-if="awaitingMore > 0") {{ $t('edubridge.teacherLessonsPage.awaitingMore', awaitingMore) }}

  //- Взносы, по которым преподаватель ещё не подписал документы.
  BaseBanner.q-mb-md(v-for="p in pendingTransfers" :key="asText(p.id)" variant="warn")
    template(#icon)
      q-icon(name="schedule")
    | {{ $t('edubridge.teacherLessonsPage.pendingTransfer', { lessons: lessonNumbersOf(p), courseTitle: p.course_title }, p.lessons.length) }}
    template(#action)
      BaseButton(variant="primary" size="sm" :loading="rowBusy === asText(p.id)" @click="onTransfer(p)") {{ $t('edubridge.teacherLessonsPage.transferMaterials') }}

  //- Календарь преподавателя: его занятия по месяцам; плитка открывает занятие, у запланированного — отчёт.
  BaseCard.q-mb-md(variant="default" :title="$t('edubridge.teacherLessonsPage.calendarTitle')")
    CardListSkeleton(v-if="firstLoad" :count="1")
    LessonCalendar(v-else :lessons="lessons" :label-of="(l) => l.group_title || l.course_title" @select="openLesson")

  //- Журнал — реестр взносов: строка — один взнос, с ним все занятия, за которые он
  //- заведён (за гарантийный срок — на несколько занятий сразу). Строка открывает
  //- правую панель; материалы и длительность каждого занятия — в ней.
  BaseCard(variant="default" :title="$t('edubridge.teacherLessonsPage.journalTitle')")
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
        //- Занятие гарантийного срока: сумма станет окончательной после срока, одна на все занятия периода.
        span.t-muted.t-sm(v-else-if="row.learners_count") {{ $t('edubridge.teacherLessonsPage.amountAfterGuarantee') }}
        span(v-else) ______
        //- Срез курса на дату занятия: по скольким участникам контракт провёл расчёт.
        .t-muted.t-sm(v-if="row.learners_count") {{ $t('edubridge.teacherLessonsPage.learnersLine', { count: row.learners_count }) }}
      template(#cell-status="{ row }")
        BaseBadge(v-if="row.contribution" :variant="statusOf(row.contribution.status).variant") {{ statusOf(row.contribution.status).label }}
        BaseBadge(v-else-if="row.learners_count" variant="info") {{ $t('edubridge.teacherLessonsPage.statusInGuarantee') }}
        template(v-else) ______
      //- Действие за преподавателем — своей колонкой справа; нажатие строку не открывает.
      template(#cell-actions="{ row }")
        BaseButton(v-if="actionOf(row) === 'transfer'" variant="primary" size="sm" :loading="rowBusy === asText(row.id)" @click.stop="onTransfer(row)") {{ $t('edubridge.teacherLessonsPage.transferMaterials') }}
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
        BaseButton(v-if="detailsAction === 'transfer'" variant="primary" :loading="rowBusy === asText(details?.id)" @click="details && onTransfer(details)") {{ $t('edubridge.teacherLessonsPage.transferMaterials') }}
        BaseButton(v-else variant="primary" :loading="rowBusy === asText(details?.id)" @click="details && onSignAct(details)") {{ $t('edubridge.teacherLessonsPage.signAct') }}

  //- Занятие из календаря: запланированное — с кнопкой отчёта, проведённое без взноса — с материалами.
  DetailsDrawer(v-model="lessonOpen" :title="lessonInView ? $t('edubridge.lesson.numberShort', { number: lessonInView.lesson_number }) + ' · ' + lessonInView.course_title : ''" :width="520")
    template(v-if="lessonInView")
      LessonDetails(:lesson="lessonInView" :teacher-name="lessonInView.teacher_username ? fioCache.get(lessonInView.teacher_username) : null")
      BaseBanner.q-mt-md(v-if="lessonInView.status === Zeus.EduLessonStatus.PLANNED && !isReportable(lessonInView)" variant="info")
        template(#icon)
          q-icon(name="schedule")
        | {{ $t('edubridge.teacherLessonsPage.reportAfterLesson', { moment: formatLessonMoment(lessonInView.ends_at) }) }}
    template(v-if="lessonInView && isReportable(lessonInView)" #footer)
      .row.justify-end
        BaseButton(variant="primary" @click="openReport(lessonInView)") {{ $t('edubridge.teacherLessonsPage.reportButton') }}

  //- Отчёт по занятию календаря: тема и материалы. Номер, дата и длительность названы календарём.
  //- Пока отчёт создаётся и материалы передаются на хранение, окно не закрывается.
  BaseDialog(:model-value="reportOpen" :title="reportTarget ? $t('edubridge.teacherLessonsPage.dialogTitleFor', { number: reportTarget.lesson_number }) : ''" size="md" @update:model-value="onReportDialog")
    BaseForm(:loading="busy" @submit="onReport")
      template(v-if="reportTarget")
        DataRow(:label="$t('edubridge.teacherLessonsPage.details.course')" :value="reportTarget.group_title ? `${reportTarget.course_title} · ${reportTarget.group_title}` : reportTarget.course_title")
        DataRow(:label="$t('edubridge.teacherLessonsPage.details.heldAt')" :value="formatLessonMoment(reportTarget.held_at)")
        DataRow.q-mb-md(:label="$t('edubridge.teacherLessonsPage.details.duration')" :value="$t('edubridge.teacherLessonsPage.durationMinutes', { minutes: reportTarget.duration_minutes })")
      BaseInput(v-model="form.topic" :label="$t('edubridge.teacherLessonsPage.topicLabel')")
      BaseInput(v-model="materialsText" :label="$t('edubridge.teacherLessonsPage.materialsLabel')" type="textarea" :rows="3" :hint="$t('edubridge.teacherLessonsPage.materialsHint')" required)
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" :disabled="busy" @click="reportOpen = false") {{ $t('edubridge.teacherLessonsPage.cancel') }}
          BaseButton(variant="primary" type="submit" :loading="busy") {{ $t('edubridge.teacherLessonsPage.submit') }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asText } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseBanner, BaseButton, BaseCard, BaseDialog, BaseForm, BaseInput, CardListSkeleton, EmptyState, BaseTable, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import { CONTRIBUTION_STATUS_LABELS, commitLessonMaterials, fetchMyContributions, fetchMyLessons, reportLesson, signAct, type IContribution, type ILesson } from '../../entities/Teacher';
import { formatLessonMoment, isReportable } from '../../entities/Lesson';
import { LessonCalendar } from '../../widgets/LessonCalendar';
import { LessonDetails } from '../../widgets/LessonDetails';
import { useFioCache } from 'src/shared/lib/account/useFioCache';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { lessonActionOf } from '../../shared/lib/lessonAction';
import { t } from '../../i18n';

/**
 * Занятия преподавателя: календарь и журнал. Занятия в календаре ставит
 * администратор; преподаватель отчитывается по занятию после его конца —
 * темой и материалами. Отчёт — это и есть взнос результатом работы: сумму
 * считает контракт по ставке часа, а материалы уходят кооперативу на
 * ответственное хранение тем же действием. Состояние взноса видно в журнале;
 * после решения совета здесь же подписывается акт приёма-передачи.
 */
const lessons = ref<ILesson[]>([]);
const contributions = ref<IContribution[]>([]);
const rowBusy = ref<string | null>(null);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);
const reportOpen = ref(false);
const reportTarget = ref<ILesson | null>(null);
const materialsText = ref('');
const form = reactive<{ topic: string }>({ topic: '' });

/** Проведённые занятия — журнал; запланированные живут в календаре. */
const heldLessons = computed(() => lessons.value.filter((l) => l.status === Zeus.EduLessonStatus.HELD));
/** Занятия, по которым отчёт открыт сейчас — по порядку дат. */
const awaitingReport = computed(() => lessons.value.filter((l) => isReportable(l)).sort((a, b) => String(a.held_at).localeCompare(String(b.held_at))));
/** Баннеров под отчёт на экране — не больше трёх; остальные занятия названы числом. */
const AWAITING_SHOWN = 3;
const awaitingShown = computed(() => awaitingReport.value.slice(0, AWAITING_SHOWN));
const awaitingMore = computed(() => Math.max(0, awaitingReport.value.length - AWAITING_SHOWN));

/**
 * Строка журнала: взнос вместе с занятиями, за которые он заведён. Взнос за
 * гарантийный срок один на все занятия периода — документы по нему подписываются
 * один раз, и в журнале он одна запись. Поля занятия в строке — от первого по номеру.
 */
type ILessonRow = ILesson & { contribution: IContribution | null; lessons: ILesson[] };

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
const actionOf = (row: ILessonRow): 'transfer' | 'sign' | null => lessonActionOf(row.contribution?.status);
/** Взнос занятия: отчёт заводит его сам, связь — по идентификатору взноса. */
const contributionOf = (lesson: ILesson) => contributions.value.find((c) => asText(c.id) === asText(lesson.contribution_id)) ?? null;

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
// Журнал — свежие записи сверху: по дате последнего занятия, при одной дате — по номеру.
const rows = computed<ILessonRow[]>(() =>
  packLessons(heldLessons.value)
    .map((pack) => ({ ...pack[0], lessons: pack, contribution: contributionOf(pack[0]) }))
    .sort((a, b) => String(lastOf(b).held_at).localeCompare(String(lastOf(a).held_at)) || byNumber(b, a)),
);
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
const detailsAction = computed<'transfer' | 'sign' | null>(() => lessonActionOf(details.value?.contribution?.status));
function openDetails(row: ILessonRow): void {
  detailsId.value = asText(row.id);
  detailsOpen.value = true;
}

/** Занятие из календаря — в своей панели: проведённое ведёт к записи журнала, запланированное — к отчёту. */
const lessonOpen = ref(false);
const lessonInViewId = ref<string | null>(null);
const lessonInView = computed(() => lessons.value.find((l) => asText(l.id) === lessonInViewId.value) ?? null);
/** Преподаватель занятия показан по имени, а не по учётной записи; имена дочитываются по мере появления занятий. */
const { fioCache, enrichFio } = useFioCache();
watch(
  () => lessons.value.map((l) => l.teacher_username).filter((u): u is string => Boolean(u)),
  (usernames) => {
    if (usernames.length) void enrichFio([...new Set(usernames)]);
  },
  { immediate: true },
);
function openLesson(l: ILesson): void {
  const row = rows.value.find((r) => r.lessons.some((x) => asText(x.id) === asText(l.id)));
  if (row) {
    openDetails(row);
    return;
  }
  lessonInViewId.value = asText(l.id);
  lessonOpen.value = true;
}

function replaceContribution(c: IContribution): void {
  const i = contributions.value.findIndex((x) => x.id === c.id);
  if (i >= 0) contributions.value[i] = c;
  else contributions.value.unshift(c);
}

/** Взносы, по которым преподаватель ещё не подписал документы. */
const pendingTransfers = computed(() => rows.value.filter((r) => actionOf(r) === 'transfer'));

const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('ru-RU') : '______');

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [l, c] = await Promise.all([fetchMyLessons(), fetchMyContributions()]);
    lessons.value = l;
    contributions.value = c;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function onReportDialog(open: boolean): void {
  if (!busy.value) reportOpen.value = open;
}

function openReport(lesson: ILesson): void {
  reportTarget.value = lesson;
  materialsText.value = '';
  form.topic = lesson.topic ?? '';
  lessonOpen.value = false;
  reportOpen.value = true;
}

/**
 * Отчёт о занятии — одно действие для преподавателя: запись отчёта и передача
 * материалов на хранение идут подряд, окно всё это время показывает загрузку
 * и закрывается, когда готово всё. В журнале занятие появляется уже с
 * переданными материалами, без промежуточного состояния.
 */
async function onReport(): Promise<void> {
  if (!reportTarget.value) return;
  busy.value = true;
  let created: ILesson | null = null;
  try {
    created = await reportLesson({
      lesson_id: asText(reportTarget.value.id),
      topic: form.topic,
      materials: materialsText.value.split('\n').map((s) => s.trim()).filter(Boolean),
    });
    const fresh = await fetchMyContributions();
    const draft = fresh.find((c) => asText(c.id) === asText(created?.contribution_id)) ?? null;
    const held = draft ? await commitLessonMaterials(draft) : null;
    contributions.value = held ? fresh.map((c) => (c.id === held.id ? held : c)) : fresh;
    lessons.value = lessons.value.map((l) => (asText(l.id) === asText(created?.id) ? (created as ILesson) : l));
    reportOpen.value = false;
    // В гарантийный срок отчёт сохраняется без документов: акт и заявление — после срока.
    SuccessAlert(t(created.contribution_id ? 'edubridge.teacherLessonsPage.reportSuccess' : 'edubridge.teacherLessonsPage.reportSavedInGuarantee'));
  } catch (e) {
    FailAlert(e);
    // Отчёт записан, а передача материалов сорвалась: окно закрывается, занятие
    // остаётся в журнале с кнопкой «Передать материалы» — отчёт повторно не создаётся.
    if (created) {
      reportOpen.value = false;
      await load();
    }
  } finally {
    busy.value = false;
  }
}

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

// Живое обновление: данные меняются в цепи и на столах других участников.
// Пока отчёт создаётся и материалы передаются, журнал не перечитывается: занятие
// появится в нём один раз, уже в готовом виде.
useLiveReload([EduLive.lessons, EduLive.assignments, EduLive.contributions], () => (busy.value ? undefined : load()));

onMounted(() => {
  void load();
});
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
