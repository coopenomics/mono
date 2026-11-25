<template lang="pug">
//- Повторная подача взноса, возвращённого на доработку: причина, затем тема и материалы
//- каждого занятия взноса. Пока материалы передаются на хранение, окно не закрывается.
BaseDialog(:model-value="Boolean(target)" :title="$t('edubridge.reportReworkDialog.title')" size="md" @update:model-value="onDialog")
  BaseForm(:loading="busy" @submit="onSubmit")
    BaseBanner.q-mb-md(v-if="target?.contribution.decline_reason" variant="warn")
      .t-eyebrow {{ $t('edubridge.reportReworkDialog.reasonLabel') }}
      div {{ target.contribution.decline_reason }}
    .edu-rework__lesson(v-for="item in items" :key="item.lesson_id")
      .t-eyebrow.q-mb-sm(v-if="items.length > 1") {{ $t('edubridge.teacherLessonsPage.lessonTitle', { number: item.number }) }}
      BaseInput(v-model="item.topic" :label="$t('edubridge.teacherLessonsPage.topicLabel')")
      BaseInput(v-model="item.materialsText" :label="$t('edubridge.teacherLessonsPage.materialsLabel')" type="textarea" :rows="3" :hint="$t('edubridge.teacherLessonsPage.materialsHint')" :required="items.length === 1")
    .t-muted.t-sm {{ $t('edubridge.reportReworkDialog.amountHint') }}
    template(#footer)
      .row.justify-end.q-gutter-sm
        BaseButton(variant="ghost" type="button" :disabled="busy" @click="emit('close')") {{ $t('edubridge.teacherLessonsPage.cancel') }}
        BaseButton(variant="primary" type="submit" :loading="busy") {{ $t('edubridge.teacherReportsPage.resubmitButton') }}
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { asText } from 'src/shared/lib/utils';
import { BaseBanner, BaseButton, BaseDialog, BaseForm, BaseInput } from 'src/shared/ui/base';
import { commitLessonMaterials, reworkContribution, type IContribution } from '../../entities/Teacher';
import { materialsToText, parseMaterials } from '../../shared/lib/materials';
import { t } from '../../i18n';
import type { IReworkTarget } from './types';

/**
 * Окно повторной подачи. Взнос не принят и возвращён преподавателю: он правит
 * материалы занятий, и взнос идёт тем же путём, что первая подача — акт
 * хранения и заявление подписываются подряд. Расчёт с обучающимися не
 * повторяется, сумма взноса прежняя. Открыто, пока задан взнос.
 */
const props = defineProps<{ target: IReworkTarget | null }>();
const emit = defineEmits<{
  close: [];
  /** Идёт подача: страница на это время не перечитывает данные. */
  busy: [boolean];
  /** Взнос подан повторно: страница перечитывает занятия и взносы. */
  done: [];
}>();

interface IReworkItem {
  lesson_id: string;
  number: number;
  topic: string;
  materialsText: string;
}

const busy = ref(false);
const items = ref<IReworkItem[]>([]);

watch(
  () => props.target,
  (target) => {
    // Прежние тема и материалы уже в полях — их правят, а не набирают заново.
    items.value = (target?.lessons ?? []).map((l) => ({
      lesson_id: asText(l.id),
      number: Number(l.lesson_number),
      topic: l.topic ?? '',
      materialsText: materialsToText(l.materials),
    }));
  },
);

function onDialog(open: boolean): void {
  if (!open && !busy.value) emit('close');
}

async function onSubmit(): Promise<void> {
  if (!props.target) return;
  busy.value = true;
  emit('busy', true);
  let draft: IContribution | null = null;
  try {
    draft = await reworkContribution({
      contribution_id: asText(props.target.contribution.id),
      lessons: items.value.map((i) => ({ lesson_id: i.lesson_id, topic: i.topic, materials: parseMaterials(i.materialsText) })),
    });
    await commitLessonMaterials(draft);
    SuccessAlert(t('edubridge.reportReworkDialog.success'));
  } catch (e) {
    FailAlert(e);
    // Материалы не исправлены — окно остаётся открытым для повтора. Исправлены, а
    // подпись документов сорвалась — окно закрывается, взнос остаётся в журнале с
    // кнопкой «Передать материалы».
    if (!draft) return;
  } finally {
    busy.value = false;
    emit('busy', false);
  }
  emit('done');
  emit('close');
}
</script>

<style scoped>
/* Занятия взноса — блоками друг под другом. */
.edu-rework__lesson + .edu-rework__lesson {
  margin-top: var(--p-4);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
</style>
