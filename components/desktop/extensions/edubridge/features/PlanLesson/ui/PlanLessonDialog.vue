<template lang="pug">
//- Занятие сверх расписания либо перенос запланированного: группа, момент,
//- длительность, преподаватель, тема. Место в программе и номер даёт сервер.
BaseDialog(:model-value="modelValue" :title="lesson ? $t('edubridge.planLesson.moveTitle', { number: lesson.lesson_number }) : $t('edubridge.planLesson.title')" size="sm" @update:model-value="close")
  BaseForm(:loading="busy" @submit="submit")
    .t-sm.t-muted.q-mb-md {{ lesson ? $t('edubridge.planLesson.moveNote') : $t('edubridge.planLesson.note') }}
    BaseSelect(v-if="!lesson && groupOptions.length !== 1" v-model="form.group_id" :label="$t('edubridge.planLesson.groupLabel')" :options="groupOptions" required)
    BaseInput(v-model="form.held_at" :label="$t('edubridge.planLesson.momentLabel')" type="datetime-local" stack-label required)
    BaseInput(v-model="form.minutes" :label="$t('edubridge.planLesson.minutesLabel')" type="number" min="5" step="5" required)
    BaseSelect(v-if="teacherOptions.length" v-model="form.assignment_id" :label="$t('edubridge.planLesson.teacherLabel')" :options="teacherChoices" clearable)
    BaseInput(v-model="form.topic" :label="$t('edubridge.planLesson.topicLabel')")
    template(#footer)
      .row.justify-end.q-gutter-sm
        BaseButton(variant="ghost" type="button" :disabled="busy" @click="close(false)") {{ $t('common.action.cancel') }}
        BaseButton(variant="primary" type="submit" :loading="busy") {{ lesson ? $t('edubridge.planLesson.moveSubmit') : $t('edubridge.planLesson.submit') }}
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asText } from 'src/shared/lib/utils';
import { BaseButton, BaseDialog, BaseForm, BaseInput, BaseSelect } from 'src/shared/ui/base';
import { moveLesson, planLesson, type ICalendarLesson } from '../../../entities/Lesson';
import { t } from '../../../i18n';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** Группы, в которые можно назначить занятие; одна — выбирать нечего. */
    groupOptions?: { value: string; label: string; lessonMinutes?: number }[];
    /** Допуски преподавателей курса группы. */
    teacherOptions?: { value: string; label: string }[];
    /** Занятие на перенос; пусто — новое занятие. */
    lesson?: ICalendarLesson | null;
  }>(),
  { groupOptions: () => [], teacherOptions: () => [], lesson: null },
);
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [ICalendarLesson] }>();

const busy = ref(false);
const form = reactive({ group_id: '', held_at: '', minutes: '60' as string | number, assignment_id: '' as string | null, topic: '' });
const teacherChoices = computed(() => [{ value: '', label: t('edubridge.scheduleSlots.teacherNone') }, ...props.teacherOptions]);


/** Момент для поля «datetime-local» — местное время без секунд. */
function toLocalInput(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    const l = props.lesson;
    const group = props.groupOptions.length === 1 ? props.groupOptions[0] : null;
    Object.assign(form, {
      group_id: l ? asText(l.group_id) : group?.value ?? '',
      held_at: toLocalInput(l ? new Date(String(l.held_at)) : nextHour()),
      minutes: String(l?.duration_minutes ?? group?.lessonMinutes ?? 60),
      assignment_id: l?.assignment_id ? asText(l.assignment_id) : '',
      topic: l?.topic ?? '',
    });
  },
  { immediate: true },
);

function nextHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function close(open: boolean): void {
  if (!busy.value) emit('update:modelValue', open);
}

async function submit(): Promise<void> {
  busy.value = true;
  try {
    const held_at = new Date(form.held_at).toISOString();
    const minutes = Number(form.minutes || 0);
    const assignment_id = form.assignment_id || null;
    const saved = props.lesson
      ? await moveLesson({ lesson_id: asText(props.lesson.id), held_at, minutes, assignment_id: assignment_id ?? '', topic: form.topic })
      : await planLesson({ group_id: form.group_id, held_at, minutes, assignment_id, topic: form.topic });
    emit('saved', saved);
    emit('update:modelValue', false);
    SuccessAlert(props.lesson ? t('edubridge.planLesson.moved') : t('edubridge.planLesson.planned'));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}
</script>
