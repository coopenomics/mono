<template lang="pug">
BaseForm(:loading="loading" @submit="submit")
  BaseInput(v-model="form.display_name" :label="$t('edubridge.learnerForm.displayNameLabel')" required)
  BaseSelect(v-model="form.recipient_type" :label="$t('edubridge.learnerForm.recipientTypeLabel')" :options="recipientOptions" required)
  BaseInput(
    v-model="form.recipient_value"
    :label="recipientLabel"
    :type="form.recipient_type === Zeus.EduRecipientType.EMAIL ? 'email' : 'text'"
    :hint="recipientHint"
    required
  )
  BaseCheckbox(:model-value="form.is_self" block @update:model-value="(v) => (form.is_self = v)") {{ $t('edubridge.learnerForm.isSelfCheckbox') }}
  template(#footer)
    .row.justify-end.q-gutter-sm
      BaseButton(variant="ghost" type="button" :disabled="loading" @click="emit('cancel')") {{ $t('edubridge.learnerForm.cancel') }}
      BaseButton(variant="primary" type="submit" :loading="loading") {{ learner ? $t('common.action.save') : $t('common.action.add') }}
</template>

<script setup lang="ts">
// realtime: форма ученика — живое перечитывание затёрло бы ввод.
import { computed, reactive, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseCheckbox, BaseForm, BaseInput, BaseSelect } from 'src/shared/ui/base';
import { addLearner, RECIPIENT_LABELS, updateLearner, type ILearner, type ILearnerInput } from '../../entities/Learner';
import { t } from '../../i18n';

const props = withDefaults(defineProps<{ learner?: ILearner | null; defaultSelf?: boolean }>(), { defaultSelf: false });
const emit = defineEmits<{ saved: [learner: ILearner]; cancel: [] }>();

const loading = ref(false);
const form = reactive<ILearnerInput>({ display_name: '', recipient_type: Zeus.EduRecipientType.EMAIL, recipient_value: '', is_self: props.defaultSelf });

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
  [Zeus.EduRecipientType.EMAIL]: t('edubridge.learnerForm.recipientLabel.EMAIL'),
  [Zeus.EduRecipientType.TELEGRAM]: t('edubridge.learnerForm.recipientLabel.TELEGRAM'),
  [Zeus.EduRecipientType.ONSITE]: t('edubridge.learnerForm.recipientLabel.ONSITE'),
};
const recipientLabel = computed(() => RECIPIENT_FIELD_LABELS[form.recipient_type] ?? t('edubridge.learnerForm.recipientLabelDefault'));
const recipientHint = computed(() =>
  form.recipient_type === Zeus.EduRecipientType.EMAIL ? t('edubridge.learnerForm.emailHint') : t('edubridge.learnerForm.contactHint'),
);

async function submit(): Promise<void> {
  loading.value = true;
  try {
    const saved = props.learner ? await updateLearner({ ...form, id: props.learner.id }) : await addLearner({ ...form });
    SuccessAlert(props.learner ? t('edubridge.learnerForm.savedSuccess') : t('edubridge.learnerForm.createdSuccess'));
    emit('saved', saved);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}
</script>
