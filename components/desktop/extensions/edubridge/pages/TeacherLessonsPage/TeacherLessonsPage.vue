<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-lessons:banner-dismissed")
    | {{ $t('edubridge.teacherLessonsPage.hintMaterials') }}

  //- Журнал занятий — реестр: базовая таблица, строка открывает правую панель
  //- с занятием. В таблице только то, по чему занятие находят и оценивают;
  //- материалы, длительность и срок хранения — в панели.
  BaseTable(
    v-if="firstLoad || rows.length"
    :columns="columns"
    :rows="rows"
    row-key="id"
    :loading="firstLoad"
    :clickable-rows="true"
    min-width="1000px"
    @row-click="openDetails"
  )
    template(#cell-lesson="{ row }")
      .edu-lessons__title {{ row.topic || $t('edubridge.teacherLessonsPage.lessonTitle', { number: row.lesson_number }) }}
      .t-muted.t-sm {{ row.course_title }}
    template(#cell-held_at="{ row }") {{ formatDate(row.held_at) }}
    template(#cell-amount="{ row }")
      span.t-num {{ row.contribution ? formatAsset2Digits(row.contribution.amount) : '______' }}
    template(#cell-status="{ row }")
      BaseBadge(v-if="row.contribution" :variant="statusOf(row.contribution.status).variant") {{ statusOf(row.contribution.status).label }}
      template(v-else) ______
    //- Действие за преподавателем — своей колонкой справа, как в реестрах Стола заказов; нажатие строку не открывает.
    template(#cell-actions="{ row }")
      BaseButton(v-if="actionOf(row) === 'transfer'" variant="primary" size="sm" :loading="rowBusy === asText(row.id)" @click.stop="onTransfer(row)") {{ $t('edubridge.teacherLessonsPage.transferMaterials') }}
      BaseButton(v-else-if="actionOf(row) === 'sign'" variant="primary" size="sm" :loading="rowBusy === asText(row.id)" @click.stop="onSignAct(row)") {{ $t('edubridge.teacherLessonsPage.signAct') }}

  //- Занятие целиком: сведения, материалы, взнос и его состояние; действие преподавателя — внизу панели.
  DetailsDrawer(v-model="detailsOpen" :title="details ? (details.topic || $t('edubridge.teacherLessonsPage.lessonTitle', { number: details.lesson_number })) : ''" :width="560")
    template(v-if="details")
      BaseBadge.q-mb-md(v-if="details.contribution" :variant="statusOf(details.contribution.status).variant") {{ statusOf(details.contribution.status).label }}
      DataRow(:label="$t('edubridge.teacherLessonsPage.details.course')" :value="details.course_title")
      DataRow(:label="$t('edubridge.teacherLessonsPage.details.number')" :value="String(details.lesson_number)")
      DataRow(:label="$t('edubridge.teacherLessonsPage.details.heldAt')" :value="formatDate(details.held_at)")
      DataRow(:label="$t('edubridge.teacherLessonsPage.details.duration')" :value="$t('edubridge.teacherLessonsPage.durationMinutes', { minutes: details.duration_minutes })")
      DataRow(v-if="details.learners_count" :label="$t('edubridge.teacherLessonsPage.details.learners')" :value="String(details.learners_count)")
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
import { BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput, BaseSelect, EmptyState, BaseTable, type BaseTableColumn } from 'src/shared/ui/base';
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
import { lessonActionOf } from '../../shared/lib/lessonAction';
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


// Сетка таблицы: «Занятие» без ширины получает остаток. Сумма заданных ширин —
// 790px при минимуме таблицы 1000px, занятию остаётся не меньше 210px.
const columns: BaseTableColumn<ILessonRow>[] = [
  { key: 'lesson_number', label: t('edubridge.teacherLessonsPage.column.number'), width: '70px', nowrap: true },
  { key: 'lesson', label: t('edubridge.teacherLessonsPage.column.lesson') },
  { key: 'held_at', label: t('edubridge.teacherLessonsPage.column.heldAt'), width: '130px', nowrap: true },
  { key: 'amount', label: t('edubridge.teacherLessonsPage.column.amount'), numeric: true, width: '150px', nowrap: true },
  { key: 'status', label: t('edubridge.teacherLessonsPage.column.status'), width: '240px', nowrap: true },
  { key: 'actions', label: '', align: 'right', width: '200px', nowrap: true },
];

const statusOf = (s: string) => CONTRIBUTION_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
/** Действие, которое сейчас за преподавателем по занятию: передать материалы либо подписать акт. */
const actionOf = (row: ILessonRow): 'transfer' | 'sign' | null => lessonActionOf(row.contribution?.status);
/** Взнос занятия: отчёт заводит его сам, связь — по идентификатору взноса. */
const contributionOf = (lesson: ILesson) => contributions.value.find((c) => asText(c.id) === asText(lesson.contribution_id)) ?? null;

// Журнал — свежие занятия сверху: по дате проведения, при одной дате — по номеру.
const rows = computed<ILessonRow[]>(() =>
  [...lessons.value]
    .sort((a, b) => String(b.held_at).localeCompare(String(a.held_at)) || Number(b.lesson_number) - Number(a.lesson_number))
    .map((l) => ({ ...l, contribution: contributionOf(l) })),
);

/** Занятие в правой панели — по идентификатору: панель показывает свежее состояние после действия и обновления журнала. */
const detailsOpen = ref(false);
const detailsId = ref<string | null>(null);
const details = computed(() => rows.value.find((r) => asText(r.id) === detailsId.value) ?? null);
/** Действие, которое сейчас за преподавателем по этому занятию. */
const detailsAction = computed<'transfer' | 'sign' | null>(() => lessonActionOf(details.value?.contribution?.status));
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
