<template lang="pug">
BaseForm(:loading="loading" @submit="submit")
  BaseInput(v-model="form.display_name" label="Имя обучающегося" required)
  BaseSelect(v-model="form.recipient_type" label="Как доставить пропуск" :options="recipientOptions" required)
  BaseInput(
    v-model="form.recipient_value"
    :label="recipientLabel"
    :type="form.recipient_type === Zeus.EduRecipientType.EMAIL ? 'email' : 'text'"
    :hint="recipientHint"
    required
  )
  BaseCheckbox(:model-value="form.is_self" block @update:model-value="(v) => (form.is_self = v)") Обучаюсь я сам(а)
  template(#footer)
    .row.justify-end.q-gutter-sm
      BaseButton(variant="ghost" type="button" :disabled="loading" @click="emit('cancel')") Отменить
      BaseButton(variant="primary" type="submit" :loading="loading") {{ learner ? 'Сохранить' : 'Добавить' }}
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseCheckbox, BaseForm, BaseInput, BaseSelect } from 'src/shared/ui/base';
import { addLearner, RECIPIENT_LABELS, updateLearner, type ILearner, type ILearnerInput } from '../../entities/Learner';

const props = defineProps<{ learner?: ILearner | null }>();
const emit = defineEmits<{ saved: [learner: ILearner]; cancel: [] }>();

const loading = ref(false);
const form = reactive<ILearnerInput>({ display_name: '', recipient_type: Zeus.EduRecipientType.EMAIL, recipient_value: '', is_self: false });

watch(
  () => props.learner,
  (l) => {
    if (!l) return;
    Object.assign(form, { display_name: l.display_name, recipient_type: l.recipient_type, recipient_value: l.recipient_value ?? '', is_self: l.is_self });
  },
  { immediate: true },
);

const recipientOptions = Object.entries(RECIPIENT_LABELS).map(([value, label]) => ({ value, label }));
const RECIPIENT_FIELD_LABELS: Record<string, string> = {
  [Zeus.EduRecipientType.EMAIL]: 'Почта обучающегося',
  [Zeus.EduRecipientType.TELEGRAM]: 'Telegram обучающегося',
  [Zeus.EduRecipientType.ONSITE]: 'Код пропуска',
};
const recipientLabel = computed(() => RECIPIENT_FIELD_LABELS[form.recipient_type] ?? 'Контакт');
const recipientHint = computed(() =>
  form.recipient_type === Zeus.EduRecipientType.EMAIL ? 'Площадке передаётся только этот адрес — ни ФИО, ни телефон.' : 'Площадке передаётся только этот контакт.',
);

async function submit(): Promise<void> {
  loading.value = true;
  try {
    const saved = props.learner ? await updateLearner({ ...form, id: props.learner.id }) : await addLearner({ ...form });
    SuccessAlert(props.learner ? 'Обучающийся сохранён' : 'Обучающийся добавлен');
    emit('saved', saved);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}
</script>
