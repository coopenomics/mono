<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-lessons:banner-dismissed")
    | {{ $t('edubridge.teacherLessonsPage.hintMaterials') }}

  BaseTable(v-if="firstLoad || lessons.length" :columns="columns" :rows="lessons" row-key="id" :loading="firstLoad" min-width="1180px")
    template(#cell-lesson_number="{ row }") № {{ row.lesson_number }}
    template(#cell-held_at="{ row }") {{ formatDate(row.held_at) }}
    template(#cell-duration_minutes="{ row }") {{ $t('edubridge.teacherLessonsPage.durationMinutes', { minutes: row.duration_minutes }) }}
    template(#cell-materials="{ row }")
      .column
        a.t-sm(v-for="link in row.materials" :key="link" :href="link" target="_blank" rel="noopener") {{ link }}
        .t-muted.t-sm(v-if="!row.materials.length") ______
    template(#cell-amount="{ row }") {{ contributionOf(row) ? formatAsset2Digits(contributionOf(row).amount) : '______' }}
    template(#cell-status="{ row }")
      template(v-if="contributionOf(row)")
        BaseBadge(:variant="statusOf(contributionOf(row).status).variant") {{ statusOf(contributionOf(row).status).label }}
        .t-muted.t-sm(v-if="contributionOf(row).status === Zeus.EduContributionStatus.HELD && contributionOf(row).hold_until") {{ $t('edubridge.teacherLessonsPage.heldUntil', { date: formatDate(contributionOf(row).hold_until) }) }}
        .t-muted.t-sm(v-if="contributionOf(row).decline_reason") {{ contributionOf(row).decline_reason }}
      template(v-else) ______
    template(#cell-actions="{ row }")
      template(v-if="contributionOf(row)")
        BaseButton(v-if="contributionOf(row).status === Zeus.EduContributionStatus.DRAFT" variant="primary" size="sm" :loading="rowBusy === row.id" @click="onTransfer(row)") {{ $t('edubridge.teacherLessonsPage.transferMaterials') }}
        BaseButton(v-else-if="contributionOf(row).status === Zeus.EduContributionStatus.COUNCIL_APPROVED" variant="primary" size="sm" :loading="rowBusy === row.id" @click="onSignAct(row)") {{ $t('edubridge.teacherLessonsPage.signAct') }}

  EmptyState(v-if="!firstLoad && !lessons.length" :title="$t('edubridge.teacherLessonsPage.emptyTitle')" :body="$t('edubridge.teacherLessonsPage.emptyBody')")
    template(#icon)
      q-icon(name="event_available" size="32px")

  BaseDialog(v-model="reportOpen" :title="$t('edubridge.teacherLessonsPage.dialogTitle')" size="md")
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
          BaseButton(variant="ghost" type="button" @click="reportOpen = false") {{ $t('edubridge.teacherLessonsPage.cancel') }}
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
import { BaseBadge, BaseButton, BaseDialog, BaseForm, BaseInput, BaseSelect, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
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

const columns: BaseTableColumn<ILesson>[] = [
  { key: 'course_title', label: t('edubridge.teacherLessonsPage.column.course') },
  { key: 'lesson_number', label: t('edubridge.teacherLessonsPage.column.lesson'), width: '110px', nowrap: true },
  { key: 'topic', label: t('edubridge.teacherLessonsPage.column.topic') },
  { key: 'held_at', label: t('edubridge.teacherLessonsPage.column.heldAt'), width: '130px', nowrap: true },
  { key: 'duration_minutes', label: t('edubridge.teacherLessonsPage.column.duration'), width: '130px', nowrap: true },
  { key: 'materials', label: t('edubridge.teacherLessonsPage.column.materials'), width: '220px' },
  { key: 'amount', label: t('edubridge.teacherLessonsPage.column.amount'), numeric: true, width: '140px' },
  { key: 'status', label: t('edubridge.teacherLessonsPage.column.status'), width: '220px' },
  { key: 'actions', label: '', align: 'right', width: '190px' },
];

const statusOf = (s: string) => CONTRIBUTION_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
/** Взнос занятия: отчёт заводит его сам, связь — по идентификатору взноса. */
const contributionOf = (lesson: ILesson) => contributions.value.find((c) => asText(c.id) === asText(lesson.contribution_id)) ?? null;

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

function openReport(): void {
  const next = lessons.value.reduce((max, l) => Math.max(max, l.lesson_number), 0) + 1;
  lessonNumber.value = String(next);
  heldAt.value = new Date().toISOString().slice(0, 10);
  materialsText.value = '';
  form.assignment_id = assignmentOptions.value[0]?.value ?? '';
  form.topic = '';
  reportOpen.value = true;
}

async function onReport(): Promise<void> {
  busy.value = true;
  try {
    const created = await reportLesson({
      assignment_id: form.assignment_id,
      lesson_number: Number(lessonNumber.value),
      topic: form.topic,
      held_at: heldAt.value ? new Date(heldAt.value).toISOString() : undefined,
      materials: materialsText.value.split('\n').map((s) => s.trim()).filter(Boolean),
    } as never);
    lessons.value = [created, ...lessons.value];
    // Отчёт записан: окно закрывается, даже если подпись документов сорвётся.
    reportOpen.value = false;
    contributions.value = await fetchMyContributions();
    // Материалы уходят на хранение тем же действием. Если подпись сорвалась,
    // отчёт уже записан — передачу повторяют кнопкой в строке занятия.
    const draft = contributionOf(created);
    rowBusy.value = asText(created.id);
    if (draft) replaceContribution(await commitLessonMaterials(draft));
    SuccessAlert(t('edubridge.teacherLessonsPage.reportSuccess'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
    rowBusy.value = null;
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
useLiveReload([EduLive.lessons, EduLive.assignments, EduLive.contributions], load);

const { registerAction } = useHeaderActions();

onMounted(() => {
  registerAction({ id: 'edubridge:create-lesson-report', component: HeaderActionButton, props: { label: t('edubridge.teacherLessonsPage.reportButton'), icon: 'add', onClick: openReport } });
  void load();
});
</script>
