<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-lessons:banner-dismissed")
    | {{ $t('edubridge.teacherLessonsPage.hintMaterials') }}

  CardListSkeleton(v-if="firstLoad" :count="3")
  //- Журнал — строками, а не таблицей: блоки переносятся при узком окне,
  //- горизонтальной прокрутки нет, состояние и действие видны всегда.
  BaseCard.edu-lessons(v-else-if="rows.length" variant="default")
    //- Строка целиком — вход в правую панель с занятием.
    .edu-lesson(v-for="row in rows" :key="asText(row.id)" role="button" tabindex="0" @click="openDetails(row)" @keydown.enter="openDetails(row)")
      //- Номер занятия — отдельной плашкой: по нему строку находят глазами.
      .edu-lesson__num
        .edu-lesson__num-value {{ row.lesson_number }}
        .edu-lesson__num-label {{ $t('edubridge.teacherLessonsPage.numberCaption') }}
      .edu-lesson__main
        .edu-lesson__title {{ row.topic || $t('edubridge.teacherLessonsPage.lessonTitle', { number: row.lesson_number }) }}
        .edu-lesson__meta {{ row.course_title }} · {{ formatDate(row.held_at) }} · {{ $t('edubridge.teacherLessonsPage.durationMinutes', { minutes: row.duration_minutes }) }}
        .edu-lesson__links(v-if="row.materials.length")
          a.edu-lesson__link(v-for="link in row.materials" :key="link" :href="link" :title="link" target="_blank" rel="noopener" @click.stop)
            q-icon(name="link" size="14px")
            span {{ linkLabel(link) }}
      .edu-lesson__amount(v-if="row.contribution")
        FeeAmount(:value="asText(row.contribution.amount)" size="md")
      .edu-lesson__state(v-if="row.contribution")
        BaseBadge(:variant="statusOf(row.contribution.status).variant") {{ statusOf(row.contribution.status).label }}
        .edu-lesson__note(v-if="row.contribution.status === Zeus.EduContributionStatus.HELD && row.contribution.hold_until") {{ $t('edubridge.teacherLessonsPage.heldUntil', { date: formatDate(row.contribution.hold_until) }) }}
        .edu-lesson__note(v-if="row.contribution.decline_reason") {{ row.contribution.decline_reason }}
        //- Действие преподавателя — под состоянием: передать материалы либо подписать акт.
        BaseButton(v-if="row.contribution.status === Zeus.EduContributionStatus.DRAFT" variant="primary" size="sm" :loading="rowBusy === asText(row.id)" @click.stop="onTransfer(row)") {{ $t('edubridge.teacherLessonsPage.transferMaterials') }}
        BaseButton(v-else-if="row.contribution.status === Zeus.EduContributionStatus.COUNCIL_APPROVED" variant="primary" size="sm" :loading="rowBusy === asText(row.id)" @click.stop="onSignAct(row)") {{ $t('edubridge.teacherLessonsPage.signAct') }}

  //- Занятие целиком: сведения, материалы, взнос и его состояние; действие преподавателя — внизу панели.
  DetailsDrawer(v-model="detailsOpen" :title="details ? (details.topic || $t('edubridge.teacherLessonsPage.lessonTitle', { number: details.lesson_number })) : ''" :width="560")
    template(v-if="details")
      BaseBadge.q-mb-md(v-if="details.contribution" :variant="statusOf(details.contribution.status).variant") {{ statusOf(details.contribution.status).label }}
      DataRow(:label="$t('edubridge.teacherLessonsPage.details.course')" :value="details.course_title")
      DataRow(:label="$t('edubridge.teacherLessonsPage.details.number')" :value="String(details.lesson_number)")
      DataRow(:label="$t('edubridge.teacherLessonsPage.details.heldAt')" :value="formatDate(details.held_at)")
      DataRow(:label="$t('edubridge.teacherLessonsPage.details.duration')" :value="$t('edubridge.teacherLessonsPage.durationMinutes', { minutes: details.duration_minutes })")
      template(v-if="details.contribution")
        DataRow(:label="$t('edubridge.teacherLessonsPage.details.amount')" :value="formatAsset2Digits(details.contribution.amount)")
        DataRow(v-if="details.contribution.hold_until" :label="$t('edubridge.teacherLessonsPage.details.holdUntil')" :value="formatDate(details.contribution.hold_until)")
        DataRow(v-if="details.contribution.decline_reason" :label="$t('edubridge.teacherLessonsPage.details.declineReason')" :value="details.contribution.decline_reason")
      .edu-lesson__section
        .t-eyebrow.q-mb-sm {{ $t('edubridge.teacherLessonsPage.details.materials') }}
        .edu-lesson__files(v-if="details.materials.length")
          a.edu-lesson__link(v-for="link in details.materials" :key="link" :href="link" target="_blank" rel="noopener")
            q-icon(name="link" size="14px")
            span {{ link }}
        .t-muted.t-sm(v-else) ______
    template(v-if="detailsAction" #footer)
      .row.justify-end
        BaseButton(v-if="detailsAction === 'transfer'" variant="primary" :loading="rowBusy === asText(details?.id)" @click="details && onTransfer(details)") {{ $t('edubridge.teacherLessonsPage.transferMaterials') }}
        BaseButton(v-else variant="primary" :loading="rowBusy === asText(details?.id)" @click="details && onSignAct(details)") {{ $t('edubridge.teacherLessonsPage.signAct') }}

  EmptyState(v-if="!firstLoad && !lessons.length" :title="$t('edubridge.teacherLessonsPage.emptyTitle')" :body="$t('edubridge.teacherLessonsPage.emptyBody')")
    template(#icon)
      q-icon(name="event_available" size="32px")

  //- Пока отчёт создаётся и материалы передаются на хранение, окно не закрывается.
  BaseDialog(:model-value="reportOpen" :title="$t('edubridge.teacherLessonsPage.dialogTitle')" size="md" @update:model-value="onReportDialog")
    BaseForm(:loading="busy" @submit="onReport")
      BaseSelect(v-model="form.assignment_id" :label="$t('edubridge.teacherLessonsPage.courseLabel')" :options="assignmentOptions" required)
      .row.q-col-gutter-md
        .col-6
          BaseInput(v-model="lessonNumber" :label="$t('edubridge.teacherLessonsPage.lessonNumberLabel')" type="number" required)
        .col-6
          BaseInput(v-model="heldAt" :label="$t('edubridge.teacherLessonsPage.heldAtLabel')" type="date" stack-label required)
      BaseInput(v-model="form.topic" :label="$t('edubridge.teacherLessonsPage.topicLabel')")
      BaseInput(v-model="materialsText" :label="$t('edubridge.teacherLessonsPage.materialsLabel')" type="textarea" :rows="3" :hint="$t('edubridge.teacherLessonsPage.materialsHint')" required)
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" :disabled="busy" @click="reportOpen = false") {{ $t('edubridge.teacherLessonsPage.cancel') }}
          BaseButton(variant="primary" type="submit" :loading="busy") {{ $t('edubridge.teacherLessonsPage.submit') }}
</template>

<script setup lang="ts">
import { useHeaderActions } from 'src/shared/hooks';
import { HeaderActionButton } from '../../shared/ui/HeaderActionButton';
import { computed, onMounted, reactive, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asText } from 'src/shared/lib/utils';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput, BaseSelect, EmptyState, BaseCard, CardListSkeleton } from 'src/shared/ui/base';
import { DataRow, DetailsDrawer, PageHint } from 'src/shared/ui/domain';
import {
  CONTRIBUTION_STATUS_LABELS,
  commitLessonMaterials,
  fetchMyAssignments,
  fetchMyContributions,
  fetchMyLessons,
  reportLesson,
  signAct,
  type IAssignment,
  type IContribution,
  type ILesson,
} from '../../entities/Teacher';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { FeeAmount } from '../../shared/ui/FeeAmount';
import { t } from '../../i18n';

/**
 * Журнал занятий преподавателя. Отчёт — это и есть взнос результатом работы:
 * сумму считает сервер по ставке часа, а материалы уходят кооперативу на
 * ответственное хранение тем же действием — акт хранения и заявление о паевом
 * взносе подписываются сразу после отчёта. Состояние взноса видно в строке
 * занятия; после решения совета здесь же подписывается акт приёма-передачи.
 */
const lessons = ref<ILesson[]>([]);
const contributions = ref<IContribution[]>([]);
const rowBusy = ref<string | null>(null);
const assignments = ref<IAssignment[]>([]);
// Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);
const reportOpen = ref(false);
const lessonNumber = ref('1');
const heldAt = ref('');
const materialsText = ref('');
const form = reactive({ assignment_id: '', topic: '' });

/** Строка журнала: занятие вместе со взносом по нему. */
type ILessonRow = ILesson & { contribution: IContribution | null };


const statusOf = (s: string) => CONTRIBUTION_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
/** Взнос занятия: отчёт заводит его сам, связь — по идентификатору взноса. */
const contributionOf = (lesson: ILesson) => contributions.value.find((c) => asText(c.id) === asText(lesson.contribution_id)) ?? null;

const rows = computed<ILessonRow[]>(() => lessons.value.map((l) => ({ ...l, contribution: contributionOf(l) })));

/** Занятие в правой панели — по идентификатору: панель показывает свежее состояние после действия и обновления журнала. */
const detailsOpen = ref(false);
const detailsId = ref<string | null>(null);
const details = computed(() => rows.value.find((r) => asText(r.id) === detailsId.value) ?? null);
/** Действие, которое сейчас за преподавателем по этому занятию. */
const detailsAction = computed<'transfer' | 'sign' | null>(() => {
  const status = details.value?.contribution?.status;
  if (status === Zeus.EduContributionStatus.DRAFT) return 'transfer';
  if (status === Zeus.EduContributionStatus.COUNCIL_APPROVED) return 'sign';
  return null;
});
function openDetails(row: ILessonRow): void {
  detailsId.value = asText(row.id);
  detailsOpen.value = true;
}

function replaceContribution(c: IContribution): void {
  const i = contributions.value.findIndex((x) => x.id === c.id);
  if (i >= 0) contributions.value[i] = c;
  else contributions.value.unshift(c);
}

const assignmentOptions = computed(() =>
  assignments.value
    .filter((a) => a.status === Zeus.EduAssignmentStatus.ACTIVE)
    .map((a) => ({ value: asText(a.id), label: a.course_title })),
);

const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('ru-RU') : '______');
/** Ссылка на материал — коротко: адрес сайта без протокола; не адрес — как есть. */
function linkLabel(link: string): string {
  try {
    const url = new URL(link);
    const path = url.pathname === '/' ? '' : url.pathname;
    const text = `${url.host}${path}`;
    return text.length > 42 ? `${text.slice(0, 41)}…` : text;
  } catch {
    return link;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [l, a, c] = await Promise.all([fetchMyLessons(), fetchMyAssignments(), fetchMyContributions()]);
    lessons.value = l;
    assignments.value = a;
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

function openReport(): void {
  const next = lessons.value.reduce((max, l) => Math.max(max, l.lesson_number), 0) + 1;
  lessonNumber.value = String(next);
  heldAt.value = new Date().toISOString().slice(0, 10);
  materialsText.value = '';
  form.assignment_id = assignmentOptions.value[0]?.value ?? '';
  form.topic = '';
  reportOpen.value = true;
}

/**
 * Отчёт о занятии — одно действие для преподавателя: запись отчёта и передача
 * материалов на хранение идут подряд, окно всё это время показывает загрузку
 * и закрывается, когда готово всё. В журнале занятие появляется уже с
 * переданными материалами, без промежуточного состояния.
 */
async function onReport(): Promise<void> {
  busy.value = true;
  let created: ILesson | null = null;
  try {
    created = await reportLesson({
      assignment_id: form.assignment_id,
      lesson_number: Number(lessonNumber.value),
      topic: form.topic,
      held_at: heldAt.value ? new Date(heldAt.value).toISOString() : undefined,
      materials: materialsText.value.split('\n').map((s) => s.trim()).filter(Boolean),
    } as never);
    const fresh = await fetchMyContributions();
    const draft = fresh.find((c) => asText(c.id) === asText(created?.contribution_id)) ?? null;
    const held = draft ? await commitLessonMaterials(draft) : null;
    contributions.value = held ? fresh.map((c) => (c.id === held.id ? held : c)) : fresh;
    lessons.value = [created, ...lessons.value];
    reportOpen.value = false;
    SuccessAlert(t('edubridge.teacherLessonsPage.reportSuccess'));
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
    SuccessAlert(t('edubridge.teacherLessonsPage.reportSuccess'));
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

const { registerAction } = useHeaderActions();

onMounted(() => {
  registerAction({ id: 'edubridge:create-lesson-report', component: HeaderActionButton, props: { label: t('edubridge.teacherLessonsPage.reportButton'), icon: 'add', onClick: openReport } });
  void load();
});
</script>

<style scoped>
/* Строка занятия: номер, суть, сумма, состояние. Суть тянется, остальное — по
   содержимому; при узком окне блоки переносятся, а не уезжают за край. */
.edu-lesson {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--p-3) var(--p-5);
  padding: var(--p-4) 0;
  border-top: 1px solid var(--p-line);
}
.edu-lesson:first-child {
  padding-top: 0;
  border-top: 0;
}
.edu-lesson:last-child {
  padding-bottom: 0;
}
.edu-lesson__num {
  flex: 0 0 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 56px;
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
}
.edu-lesson__num-value {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.1;
  color: var(--p-ink);
  font-variant-numeric: tabular-nums;
}
.edu-lesson__num-label {
  font-size: 10px;
  line-height: 1.2;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--p-ink-3);
}
.edu-lesson__main {
  flex: 1 1 260px;
  min-width: 0;
}
.edu-lesson__title {
  font-size: var(--p-fs-body);
  font-weight: 600;
  line-height: 1.35;
  color: var(--p-ink);
  overflow-wrap: anywhere;
}
.edu-lesson__meta,
.edu-lesson__note {
  font-size: var(--p-fs-meta, 12px);
  line-height: 1.4;
  color: var(--p-ink-3);
}
.edu-lesson__meta {
  margin-top: 2px;
}
.edu-lesson__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-1) var(--p-3);
  margin-top: var(--p-2);
}
.edu-lesson__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  font-size: var(--p-fs-body-sm);
  color: var(--p-primary);
  text-decoration: none;
}
.edu-lesson__link:hover {
  text-decoration: underline;
}
.edu-lesson__link span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.edu-lesson__amount {
  flex: 0 0 auto;
  padding-top: 2px;
}
.edu-lesson__state {
  flex: 0 0 220px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-1);
}
.edu-lesson {
  cursor: pointer;
}
.edu-lesson:hover .edu-lesson__title,
.edu-lesson:focus-visible .edu-lesson__title {
  color: var(--p-primary);
}
.edu-lesson:focus-visible {
  outline: none;
}
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
.edu-lesson__files .edu-lesson__link span {
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
