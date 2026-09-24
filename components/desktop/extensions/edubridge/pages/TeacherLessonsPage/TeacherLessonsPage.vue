<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-lessons:banner-dismissed")
    | {{ $t('edubridge.teacherLessonsPage.hintMaterials') }}
    | {{ $t('edubridge.teacherLessonsPage.hintRate') }}
    | {{ $t('edubridge.teacherLessonsPage.hintGuarantee') }}

  .row.justify-end.q-mb-md
    BaseButton(variant="primary" @click="openReport")
      template(#icon-left)
        q-icon(name="add" size="18px")
      | {{ $t('edubridge.teacherLessonsPage.reportButton') }}

  BaseTable(v-if="loading || lessons.length" :columns="columns" :rows="lessons" row-key="id" :loading="firstLoad" min-width="820px")
    template(#cell-lesson_number="{ row }") № {{ row.lesson_number }}
    template(#cell-held_at="{ row }") {{ formatDate(row.held_at) }}
    template(#cell-duration_minutes="{ row }") {{ $t('edubridge.teacherLessonsPage.durationMinutes', { minutes: row.duration_minutes }) }}
    template(#cell-materials="{ row }")
      .column
        a.t-sm(v-for="link in row.materials" :key="link" :href="link" target="_blank" rel="noopener") {{ link }}
        .t-muted.t-sm(v-if="!row.materials.length") ______

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
      BaseInput(v-model="duration" :label="$t('edubridge.teacherLessonsPage.durationLabel')" type="number" :hint="$t('edubridge.teacherLessonsPage.durationHint')")
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" @click="reportOpen = false") {{ $t('edubridge.teacherLessonsPage.cancel') }}
          BaseButton(variant="primary" type="submit" :loading="busy") {{ $t('edubridge.teacherLessonsPage.submit') }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asText } from 'src/shared/lib/utils';
import { BaseButton, BaseDialog, BaseForm, BaseInput, BaseSelect, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { fetchMyAssignments, fetchMyLessons, reportLesson, type IAssignment, type ILesson } from '../../entities/Teacher';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

/**
 * Журнал занятий преподавателя. Отчёт — это и есть подача взноса: сумму считает
 * сервер по ставке часа, поэтому произвольного ввода здесь нет. Дальше взнос
 * виден на странице «Мои взносы»: там подписывается заявление и акт.
 */
const lessons = ref<ILesson[]>([]);
const assignments = ref<IAssignment[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);
const reportOpen = ref(false);
const lessonNumber = ref('1');
const heldAt = ref('');
const duration = ref('');
const materialsText = ref('');
const form = reactive({ assignment_id: '', topic: '' });

const columns: BaseTableColumn<ILesson>[] = [
  { key: 'course_title', label: t('edubridge.teacherLessonsPage.column.course') },
  { key: 'lesson_number', label: t('edubridge.teacherLessonsPage.column.lesson'), width: '110px', nowrap: true },
  { key: 'topic', label: t('edubridge.teacherLessonsPage.column.topic') },
  { key: 'held_at', label: t('edubridge.teacherLessonsPage.column.heldAt'), width: '130px', nowrap: true },
  { key: 'duration_minutes', label: t('edubridge.teacherLessonsPage.column.duration'), width: '130px', nowrap: true },
  { key: 'materials', label: t('edubridge.teacherLessonsPage.column.materials'), width: '260px' },
];

const assignmentOptions = computed(() =>
  assignments.value
    .filter((a) => a.status === Zeus.EduAssignmentStatus.ACTIVE)
    .map((a) => ({ value: asText(a.id), label: a.course_title })),
);

const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('ru-RU') : '______');

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [l, a] = await Promise.all([fetchMyLessons(), fetchMyAssignments()]);
    lessons.value = l;
    assignments.value = a;
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
  duration.value = '';
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
      duration_minutes: duration.value ? Number(duration.value) : undefined,
      materials: materialsText.value.split('\n').map((s) => s.trim()).filter(Boolean),
    } as never);
    lessons.value = [created, ...lessons.value];
    reportOpen.value = false;
    SuccessAlert(t('edubridge.teacherLessonsPage.reportSuccess'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

// Живое обновление: данные меняются в цепи и на столах других участников.
useLiveReload([EduLive.lessons, EduLive.assignments], load);

onMounted(load);
</script>
