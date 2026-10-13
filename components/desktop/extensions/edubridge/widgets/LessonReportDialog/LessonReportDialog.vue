<template lang="pug">
//- Отчёт по занятию календаря: тема и материалы. Номер, дата и длительность названы календарём.
//- Пока отчёт создаётся и материалы передаются на хранение, окно не закрывается.
BaseDialog(:model-value="Boolean(lesson)" :title="lesson ? $t('edubridge.teacherLessonsPage.dialogTitleFor', { number: lesson.lesson_number }) : ''" size="md" @update:model-value="onDialog")
  BaseForm(:loading="busy" @submit="onReport")
    template(v-if="lesson")
      DataRow(:label="$t('edubridge.teacherLessonsPage.details.course')" :value="lesson.group_title ? `${lesson.course_title} · ${lesson.group_title}` : lesson.course_title")
      DataRow(:label="$t('edubridge.teacherLessonsPage.details.heldAt')" :value="formatLessonMoment(lesson.held_at)")
      DataRow.q-mb-md(:label="$t('edubridge.teacherLessonsPage.details.duration')" :value="$t('edubridge.teacherLessonsPage.durationMinutes', { minutes: lesson.duration_minutes })")
    BaseInput(v-model="topic" :label="$t('edubridge.teacherLessonsPage.topicLabel')")
    BaseInput(v-model="materialsText" :label="$t('edubridge.teacherLessonsPage.materialsLabel')" type="textarea" :rows="3" :hint="$t('edubridge.teacherLessonsPage.materialsHint')" required)
    template(#footer)
      .row.justify-end.q-gutter-sm
        BaseButton(variant="ghost" type="button" :disabled="busy" @click="emit('close')") {{ $t('edubridge.teacherLessonsPage.cancel') }}
        BaseButton(variant="primary" type="submit" :loading="busy") {{ $t('edubridge.teacherLessonsPage.submit') }}
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asText } from 'src/shared/lib/utils';
import { BaseButton, BaseDialog, BaseForm, BaseInput } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { commitLessonMaterials, fetchMyContributions, reportLesson, type ILesson } from '../../entities/Teacher';
import { formatLessonMoment } from '../../entities/Lesson';
import { t } from '../../i18n';

/**
 * Окно отчёта преподавателя о занятии. Отчёт — одно действие: запись отчёта и
 * передача материалов на хранение идут подряд, окно всё это время показывает
 * загрузку и закрывается, когда готово всё. Открыто, пока задано занятие.
 */
const props = defineProps<{ lesson: ILesson | null }>();
const emit = defineEmits<{
  close: [];
  /** Идёт отчёт: страница на это время не перечитывает данные. */
  busy: [boolean];
  /** Отчёт записан: страница перечитывает занятия и взносы. */
  done: [];
}>();

const busy = ref(false);
const topic = ref('');
const materialsText = ref('');

watch(
  () => props.lesson,
  (lesson) => {
    topic.value = lesson?.topic ?? '';
    materialsText.value = '';
  },
);

function onDialog(open: boolean): void {
  if (!open && !busy.value) emit('close');
}

async function onReport(): Promise<void> {
  if (!props.lesson) return;
  busy.value = true;
  emit('busy', true);
  let created: ILesson | null = null;
  try {
    created = await reportLesson({
      lesson_id: asText(props.lesson.id),
      topic: topic.value,
      materials: materialsText.value.split('\n').map((s) => s.trim()).filter(Boolean),
    });
    const draft = (await fetchMyContributions()).find((c) => asText(c.id) === asText(created?.contribution_id)) ?? null;
    if (draft) await commitLessonMaterials(draft);
    // В гарантийный срок отчёт сохраняется без документов: акт и заявление — после срока.
    SuccessAlert(t(created.contribution_id ? 'edubridge.teacherLessonsPage.reportSuccess' : 'edubridge.teacherLessonsPage.reportSavedInGuarantee'));
  } catch (e) {
    FailAlert(e);
    // Отчёт не записан — окно остаётся открытым для повтора. Отчёт записан, а передача
    // материалов сорвалась — окно закрывается, занятие остаётся в журнале с кнопкой
    // «Передать материалы»: отчёт повторно не создаётся.
    if (!created) return;
  } finally {
    busy.value = false;
    emit('busy', false);
  }
  emit('done');
  emit('close');
}
</script>
