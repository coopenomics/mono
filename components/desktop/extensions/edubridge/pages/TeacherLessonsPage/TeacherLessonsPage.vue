<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:teacher-lessons:banner-dismissed")
    | После занятия приложите его материалы — запись, конспект, задания. По ним считается ваш паевой взнос:
    | часы занятия по вашей ставке. Заявление подписывается один раз и уходит в совет само, когда пройдёт
    | гарантийный срок курса.

  .row.justify-end.q-mb-md
    BaseButton(variant="primary" @click="openReport")
      template(#icon-left)
        q-icon(name="add" size="18px")
      | Отчитаться о занятии

  BaseTable(v-if="loading || lessons.length" :columns="columns" :rows="lessons" row-key="id" :loading="firstLoad" min-width="820px")
    template(#cell-lesson_number="{ row }") № {{ row.lesson_number }}
    template(#cell-held_at="{ row }") {{ formatDate(row.held_at) }}
    template(#cell-duration_minutes="{ row }") {{ row.duration_minutes }} мин
    template(#cell-materials="{ row }")
      .column
        a.t-sm(v-for="link in row.materials" :key="link" :href="link" target="_blank" rel="noopener") {{ link }}
        .t-muted.t-sm(v-if="!row.materials.length") ______

  EmptyState(v-if="!firstLoad && !lessons.length" title="Занятий пока нет" body="Первый отчёт появится здесь после проведённого занятия.")
    template(#icon)
      q-icon(name="event_available" size="32px")

  BaseDialog(v-model="reportOpen" title="Отчёт о занятии" size="md")
    BaseForm(:loading="busy" @submit="onReport")
      BaseSelect(v-model="form.assignment_id" label="Курс" :options="assignmentOptions" required)
      .row.q-col-gutter-md
        .col-6
          BaseInput(v-model="lessonNumber" label="Номер занятия" type="number" required)
        .col-6
          BaseInput(v-model="heldAt" label="Дата занятия" type="date" stack-label required)
      BaseInput(v-model="form.topic" label="Тема занятия")
      BaseInput(v-model="materialsText" label="Материалы занятия" type="textarea" :rows="3" hint="По одной ссылке на строку" required)
      BaseInput(v-model="duration" label="Длительность, минут" type="number" hint="Без значения — из расписания курса")
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" @click="reportOpen = false") Отменить
          BaseButton(variant="primary" type="submit" :loading="busy") Отчитаться
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
  { key: 'course_title', label: 'Курс' },
  { key: 'lesson_number', label: 'Занятие', width: '110px', nowrap: true },
  { key: 'topic', label: 'Тема' },
  { key: 'held_at', label: 'Проведено', width: '130px', nowrap: true },
  { key: 'duration_minutes', label: 'Длительность', width: '130px', nowrap: true },
  { key: 'materials', label: 'Материалы', width: '260px' },
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
    SuccessAlert('Занятие записано — материалы ждут передачи на хранение');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>
